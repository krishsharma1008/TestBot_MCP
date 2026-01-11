#!/usr/bin/env node

/**
 * Generate Attachments Manifest
 * Scans test-results folders and creates a manifest mapping test files to their attachments
 */

const fs = require('fs');
const path = require('path');

function generateAttachmentsManifest() {
    const testResultsDir = path.join(__dirname, '..', 'test-results');
    const outputFile = path.join(__dirname, '..', 'custom-report', 'attachments-manifest.json');
    
    const manifest = {};
    
    if (!fs.existsSync(testResultsDir)) {
        console.log('⚠️  test-results directory not found');
        return;
    }
    
    // Read all folders in test-results
    const folders = fs.readdirSync(testResultsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    
    console.log(`📂 Scanning ${folders.length} test result folders...`);
    
    folders.forEach(folderName => {
        // Extract test file name from folder (e.g., mscship_15-MSCSHIP-15-... -> mscship_15)
        const testFileMatch = folderName.match(/^(mscship_\d+)/i);
        if (!testFileMatch) return;
        
        const testFileName = testFileMatch[1];
        const testFile = `tests/jira-generated/${testFileName}.spec.js`;
        
        const folderPath = path.join(testResultsDir, folderName);
        const files = fs.readdirSync(folderPath);
        
        const attachments = {
            screenshots: [],
            videos: [],
            traces: [],
            other: []
        };
        
        files.forEach(fileName => {
            const relativePath = `../test-results/${folderName}/${fileName}`;
            
            if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
                attachments.screenshots.push({
                    name: fileName,
                    path: relativePath,
                    contentType: 'image/png'
                });
            } else if (fileName.endsWith('.webm') || fileName.endsWith('.mp4')) {
                attachments.videos.push({
                    name: fileName,
                    path: relativePath,
                    contentType: 'video/webm'
                });
            } else if (fileName.endsWith('.zip')) {
                attachments.traces.push({
                    name: fileName,
                    path: relativePath,
                    contentType: 'application/zip'
                });
            } else {
                attachments.other.push({
                    name: fileName,
                    path: relativePath,
                    contentType: 'application/octet-stream'
                });
            }
        });
        
        // Only add to manifest if there are attachments
        if (attachments.screenshots.length > 0 || 
            attachments.videos.length > 0 || 
            attachments.traces.length > 0 || 
            attachments.other.length > 0) {
            manifest[testFile] = attachments;
        }
    });
    
    // Write manifest file
    fs.writeFileSync(outputFile, JSON.stringify(manifest, null, 2));
    console.log(`✅ Generated attachments manifest with ${Object.keys(manifest).length} test entries`);
    console.log(`📄 Manifest saved to: ${outputFile}`);
}

// Run if called directly
if (require.main === module) {
    generateAttachmentsManifest();
}

module.exports = { generateAttachmentsManifest };
