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
        const { fileCabinetId, metadata, username, password } = req.body;

        // Validating required fields, removing documentBase64
        if (!fileCabinetId || !metadata || !metadata.memberId || !metadata.memberName || !username || !password) {
            return res.status(400).json({
                status: "error",
                message: "Invalid request: missing required fields (fileCabinetId, metadata, username, password)."
            });
        }

        // Here you can handle the documentBase64 case
        const documentBase64 = req.body.documentBase64 || null;

        let documentBuffer;
        if (documentBase64) {
            // Convert Base64 string into a binary buffer only if provided
            documentBuffer = Buffer.from(documentBase64, 'base64');
        } else {
            // If documentBase64 is not provided, return an error or handle as needed
            return res.status(400).json({
                status: "error",
                message: "documentBase64 is required."
            });
        }

        const tempPdfFileName = `${metadata.memberId}_${metadata.memberName.replace(/\s/g, '_')}.pdf`;
        const tempPdfPath = path.join(__dirname, tempPdfFileName);

        fs.writeFileSync(tempPdfPath, documentBuffer);

        const docuwareApiUrl = `https://infomark-tc-limited.docuware.cloud/DocuWare/Platform/FileCabinets/${fileCabinetId}/Documents`;

        const basicAuth = encodeBasicAuth(username, password);

        const formData = new FormData();
        formData.append('file', fs.createReadStream(tempPdfPath)); // Attach the PDF file
        formData.append('DocumentType', 'Diaspora Membership Form'); // Set document type
        formData.append('MemberName', metadata.memberName); // Member name as metadata
        formData.append('MemberId', metadata.memberId); // Member ID as metadata

        const docuwareResponse = await axios.post(docuwareApiUrl, formData, {
            headers: {
                'Authorization': `Basic ${basicAuth}`, // Basic Authentication
                'Content-Type': `multipart/form-data; boundary=${formData._boundary}`
            }
        });

        fs.unlinkSync(tempPdfPath);

        res.json({
            status: "success",
            message: "Document successfully uploaded to DocuWare",
            documentId: docuwareResponse.data.documentId,
            docuwareUrl: docuwareResponse.data.docuwareUrl
        });

    } catch (error) {
        console.error('Error uploading document:', error);

        // Return error response in case of failure
        res.status(500).json({
            status: "error",
            message: "Failed to upload document",
            error: {
                code: "DOC_UPLOAD_FAIL",
                details: error.message
            }
        });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API is running on http://localhost:${PORT}`);
});
