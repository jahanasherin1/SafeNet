#!/bin/bash

# Test profile image upload with Cloudinary transformation locally

echo "🧪 Testing Profile Image Upload with Transformation"
echo "Location: http://localhost:5000/api/auth/update-profile"
echo

# Use curl to upload image with transformation
curl -X POST http://localhost:5000/api/auth/update-profile \
  -F "profileImage=@assets/images/icon.png" \
  -F "currentEmail=testuser@example.com" \
  -F "name=Test User" \
  -F "phone=9876543210" \
  -H "Content-Type: multipart/form-data" \
  -v

echo
echo "✅ Upload test complete"
