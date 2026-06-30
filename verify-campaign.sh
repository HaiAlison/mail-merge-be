#!/bin/bash

# Configuration
API_URL="http://localhost:3000"

# 1. Upload Attachment
echo "Step 1: Uploading Attachment..."
echo "This is a test file" > test.txt
UPLOAD_RESPONSE=$(curl -s -X POST -H "Content-Type: multipart/form-data" -F "file=@test.txt" "$API_URL/campaigns/attachments")
echo "Response: $UPLOAD_RESPONSE"
ATTACHMENT_ID=$(echo $UPLOAD_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Attachment ID: $ATTACHMENT_ID"

if [ -z "$ATTACHMENT_ID" ]; then
  echo "Upload failed!"
  exit 1
fi

# 2. Create Campaign
echo "Step 2: Creating Campaign..."
CAMPAIGN_PAYLOAD=$(cat <<EOF
{
  "name": "Test Campaign",
  "template": {
    "subject": "Hello {{name}}",
    "content": "Content with {{custom_field}}"
  },
  "recipients": [
    { "email": "dzy@example.com", "name": "Dzy", "custom_field": "TestValue" }
  ],
  "attachmentIds": ["$ATTACHMENT_ID"]
}
EOF
)

CREATE_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$CAMPAIGN_PAYLOAD" "$API_URL/campaigns")
echo "Response: $CREATE_RESPONSE"
CAMPAIGN_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Campaign ID: $CAMPAIGN_ID"

if [ -z "$CAMPAIGN_ID" ]; then
  echo "Campaign creation failed!"
  exit 1
fi

# 3. Send Campaign
echo "Step 3: Sending Campaign..."
SEND_RESPONSE=$(curl -s -X POST "$API_URL/campaigns/$CAMPAIGN_ID/send")
echo "Response: $SEND_RESPONSE"

# Cleanup
rm test.txt
