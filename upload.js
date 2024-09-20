const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json()); // JSON request bodies

const encodeBasicAuth = (username, password) => {
    return Buffer.from(`${username}:${password}`).toString('base64');
};

app.post('/api/v1/upload-diaspora-document', async (req, res) => {
    try {
        const { fileCabinetId, metadata, username, password, organizationId, documentBase64 } = req.body;

        // Validate required fields
        if (!fileCabinetId || !metadata || !metadata.memberId || !metadata.memberName || !username || !password || !organizationId) {
            return res.status(400).json({
                status: "error",
                message: "Invalid request: missing required fields (fileCabinetId, metadata, username, password, organizationId)."
            });
        }

        const docuwareApiUrl = `https://infomark-tc-limited.docuware.cloud/DocuWare/Platform/FileCabinets/${fileCabinetId}/Documents`;

        const formData = new FormData();
        formData.append('DocumentType', 'Diaspora Membership Form'); // Set document type
        formData.append('MemberName', metadata.memberName); // Member name
        formData.append('MemberId', metadata.memberId); // Member ID
        if (metadata.passportNumber) {
            formData.append('PassportNumber', metadata.passportNumber); // Passport number
        }
        if (metadata.idNumber) {
            formData.append('IdNumber', metadata.idNumber); // ID number
        }
        if (metadata.branch) {
            formData.append('Branch', metadata.branch); // Branch
        }

        // Check if documentBase64 is provided and valid
        if (documentBase64) {
            // Validate if the provided string is a valid Base64
            if (isValidBase64(documentBase64)) {
                const documentBuffer = Buffer.from(documentBase64, 'base64');
                const tempPdfFileName = `${metadata.memberId}_${metadata.memberName.replace(/\s/g, '_')}.pdf`;
                const tempPdfPath = path.join(__dirname, tempPdfFileName);
                fs.writeFileSync(tempPdfPath, documentBuffer);
                formData.append('file', fs.createReadStream(tempPdfPath)); // Attach the PDF file
                fs.unlinkSync(tempPdfPath); // Clean up the temporary file
            } else {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid Base64 string provided."
                });
            }
        }

        // Encode username and password for Basic Auth
        const basicAuth = encodeBasicAuth(username, password);

        // Send the request to DocuWare with the organization ID in the headers
        const docuwareResponse = await axios.post(docuwareApiUrl, formData, {
            headers: {
                'Authorization': `Basic ${basicAuth}`, // Use the encoded username and password
                'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
                'X-DocuWare-Organization': organizationId // Add organization ID
            }
        });

        res.json({
            status: "success",
            message: "Record successfully created in DocuWare",
            documentId: docuwareResponse.data.documentId,
            docuwareUrl: docuwareResponse.data.docuwareUrl
        });

    } catch (error) {
        console.error('Error uploading document:', error.response ? error.response.data : error.message);

        res.status(500).json({
            status: "error",
            message: "Failed to create record in DocuWare",
            error: {
                code: "DOC_UPLOAD_FAIL",
                details: error.response ? error.response.data : error.message
            }
        });
    }
});

// Helper function to validate Base64 string
const isValidBase64 = (str) => {
    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{1,2})?$/;
    return base64Regex.test(str);
};

// Start the server on a different port
const PORT = process.env.PORT || 4000; // Change the port here
app.listen(PORT, () => {
    console.log(`API is running on http://localhost:${PORT}`);
});
