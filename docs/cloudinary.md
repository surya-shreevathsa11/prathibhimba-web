Admin clicks Upload
↓
Frontend calls GET /api/admin/cloudinary-signature (protected by requireAdmin)
↓
Backend generates signature using Cloudinary API secret (never exposed)
↓
Frontend uses signature + timestamp to upload directly to Cloudinary
↓
Cloudinary validates signature — rejects anything without a valid one
