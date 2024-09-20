const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const app = express();
app.use(bodyParser.json()); // JSON request bodies

const encodeBasicAuth = (username, password) => {
    return Buffer.from(`${username}:${password}`).toString('base64');
};

app.post('/api/v1/upload-diaspora-document', async (req, res) => {
    try {
        const { fileCabinetId, metadata, username, password, documentBase64 } = req.body;

        // Validate required fields
        if (!fileCabinetId || !metadata || !metadata.memberId || !metadata.memberName || !username || !password) {
            return res.status(400).json({
                status: "error",
                message: "Invalid request: missing required fields (fileCabinetId, metadata, username, password)."
            });
        }

        // If documentBase64 is not provided, skip upload and respond with metadata
        if (!documentBase64) {
            return res.json({
                status: "success",
                message: "Document uploaded.",
                metadata: {
                    memberId: metadata.memberId,
                    memberName: metadata.memberName
                }
            });
        }

        let tempPdfPath;

        // Decode the Base64 document and save it as a PDF
        const documentBuffer = Buffer.from(documentBase64, 'base64');
        const tempPdfFileName = `${metadata.memberId}_${metadata.memberName.replace(/\s/g, '_')}.pdf`;
        tempPdfPath = path.join(__dirname, tempPdfFileName);

        // Write the buffer to a PDF file
        fs.writeFileSync(tempPdfPath, documentBuffer);

        const docuwareApiUrl = `https://infomark-tc-limited.docuware.cloud/DocuWare/Platform/FileCabinets/${fileCabinetId}/Documents`;
        const basicAuth = encodeBasicAuth(username, password);

        const formData = new FormData();
        formData.append('file', fs.createReadStream(tempPdfPath)); // Attach the PDF file
        formData.append('DocumentType', 'Diaspora Membership Form'); // Set document type
        formData.append('MemberName', metadata.memberName); // Member name as metadata
        formData.append('MemberId', metadata.memberId); // Member ID as metadata

        // Send the request to DocuWare
        const docuwareResponse = await axios.post(docuwareApiUrl, formData, {
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}` // Use FormData's method to get boundary
            }
        });

        fs.unlinkSync(tempPdfPath); // Clean up the temporary file

        res.json({
            status: "success",
            message: "Document successfully uploaded to DocuWare",
            documentId: docuwareResponse.data.documentId,
            docuwareUrl: docuwareResponse.data.docuwareUrl
        });

    } catch (error) {
        console.error('Error uploading document:', error.response ? error.response.data : error.message);

        res.status(500).json({
            status: "error",
            message: "Failed to upload document",
            error: {
                code: "DOC_UPLOAD_FAIL",
                details: error.response ? error.response.data : error.message
            }
        });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API is running on http://localhost:${PORT}`);
});
