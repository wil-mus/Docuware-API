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
        const { fileCabinetId, metadata, documentBase64, username, password } = req.body;

        // Validating required fields
        if (!fileCabinetId || !documentBase64 || !metadata || !metadata.memberId || !metadata.memberName || !username || !password) {
            return res.status(400).json({
                status: "error",
                message: "Invalid request: missing required fields (fileCabinetId, documentBase64, metadata, username, password)."
            });
        }

        const documentBuffer = Buffer.from(documentBase64, 'base64');
        
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
