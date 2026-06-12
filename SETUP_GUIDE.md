# Setup Guide for New Features

## 1. Database Setup
Run the following SQL file in your Supabase SQL Editor:
1. `supabase/migrations/003_add_file_columns_to_school_documents.sql` - Adds file-related columns to `school_documents`

## 2. Storage Bucket Setup (Manual Steps)
You need to set up TWO storage buckets manually in the Supabase Dashboard:

---

### Bucket 1: school-documents (For Documents)
1. Go to your Supabase project dashboard → Storage
2. Click "New bucket"
3. Bucket name: `school-documents`
4. Toggle the bucket to be "Public"
5. Add these 4 policies for this bucket:

#### Policy 1: Authenticated users can upload school documents
- **Operation**: INSERT
- **Target roles**: authenticated
- **Policy definition**: `(bucket_id = 'school-documents'::text)`

#### Policy 2: Authenticated users can view school documents
- **Operation**: SELECT
- **Target roles**: authenticated
- **Policy definition**: `(bucket_id = 'school-documents'::text)`

#### Policy 3: Public can view school documents
- **Operation**: SELECT
- **Target roles**: public
- **Policy definition**: `(bucket_id = 'school-documents'::text)`

#### Policy 4: Authenticated users can delete school documents
- **Operation**: DELETE
- **Target roles**: authenticated
- **Policy definition**: `(bucket_id = 'school-documents'::text)`

---

### Bucket 2: school-assets (For Logos & Branding)
1. Go to your Supabase project dashboard → Storage
2. Click "New bucket"
3. Bucket name: `school-assets`
4. Toggle the bucket to be "Public"
5. Add these 4 policies for this bucket:

#### Policy 1: Authenticated users can upload school assets
- **Operation**: INSERT
- **Target roles**: authenticated
- **Policy definition**: `(bucket_id = 'school-assets'::text)`

#### Policy 2: Authenticated users can view school assets
- **Operation**: SELECT
- **Target roles**: authenticated
- **Policy definition**: `(bucket_id = 'school-assets'::text)`

#### Policy 3: Public can view school assets
- **Operation**: SELECT
- **Target roles**: public
- **Policy definition**: `(bucket_id = 'school-assets'::text)`

#### Policy 4: Authenticated users can delete school assets
- **Operation**: DELETE
- **Target roles**: authenticated
- **Policy definition**: `(bucket_id = 'school-assets'::text)`

---

## 3. File Upload Features
- Admins can now upload files (PDF, DOC, DOCX, PNG, JPG, XLS, XLSX)
- Files are stored in Supabase Storage
- Parents can download/view files in the Parent Portal
- If upload fails: app gives the option to save without the file

## 4. UNEB Grading System
- Teacher Dashboard now has UNEB grading engine integrated
- Supports both O-Level and A-Level grading
- Features include:
  - Imported all UNEB functions from `uneb-engine.js`
  - State for O-Level/A-Level toggle
  - Single/multiple papers/full UNEB assessment types
  - show/hide grade preview

## 5. Fixed School Settings
- School name field is now editable (no longer read-only!)
- School name saves correctly to database
- Logo upload fails gracefully if storage bucket not set up
