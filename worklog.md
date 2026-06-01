---
Task ID: 1
Agent: main
Task: Add EPUB and DOCX/XLSX files as default demo files

Work Log:
- Analyzed current demo file system (demos.ts with inline text content only)
- Identified binary files from upload directory: EPUB (5MB), XLSX (8.6KB)
- Found a small DOCX file from mammoth test data for demo
- Created public/demo/ directory and copied 3 binary demo files
- Updated demos.ts with DEMO_BINARY_FILES config and fetchBinaryDemoFiles() async function
- Updated page.tsx loadDemoFiles to be async, loading both text and binary demos
- Added loading spinner state for demo file button while fetching
- Verified all 3 demo files are accessible via HTTP (200 status)

Stage Summary:
- 3 binary demo files added: demo.docx, test_features.xlsx, 精通Python爬虫框架Scrapy.epub
- Demo system now supports both inline text and URL-fetched binary files
- loadDemoFiles is now async with loading indicator
- Total demo files: 5 text + 3 binary = 8 files
