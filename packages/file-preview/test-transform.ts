/**
 * 测试 transform-table 的图片提取逻辑
 */
import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { detectImageFormat, parseImageDimensions, bufferToBase64, getMimeType, BROWSER_SUPPORTED_FORMATS } from './src/excel/media';

async function testTransform() {
  const filePath = '/home/lambert/githubRepos/filevista/apps/playground/public/demo/禁寄限寄物品清单V2.1.xlsx';
  const buffer = readFileSync(filePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ));

  const sheet = workbook.worksheets[0];
  console.log('=== 测试图片提取逻辑 ===\n');
  console.log(`工作表: ${sheet.name}`);

  // 模拟 transform-table.ts 中的图片提取逻辑
  const cellImages = new Map<string, any[]>();
  let totalImages = 0;

  try {
    const wsImages = sheet.getImages();
    console.log(`找到 ${wsImages.length} 张图片\n`);

    for (const img of wsImages) {
      const imageId = parseInt(img.imageId, 10);
      if (isNaN(imageId)) continue;

      const imageData = workbook.getImage(imageId);
      if (!imageData?.buffer) continue;

      const buf = imageData.buffer;
      const format = detectImageFormat(buf);
      const isSupported = BROWSER_SUPPORTED_FORMATS.has(format);
      const mimeType = getMimeType(format);
      const base64 = bufferToBase64(buf);

      const range = img.range;
      if (!range?.tl) continue;

      const tlRow = range.tl.nativeRow ?? 0;
      const tlCol = range.tl.nativeCol ?? 0;
      const key = `${tlRow}-${tlCol}`;

      const dims = parseImageDimensions(buf);

      const embedded = {
        dataUrl: isSupported ? `data:${mimeType};base64,${base64.substring(0, 50)}...` : null,
        naturalWidth: dims.width,
        naturalHeight: dims.height,
        unsupported: !isSupported,
        formatName: format.toUpperCase(),
      };

      console.log(`图片 ${totalImages + 1}:`);
      console.log(`  位置: row=${tlRow}, col=${tlCol} (key: ${key})`);
      console.log(`  格式: ${format} (${isSupported ? '支持' : '不支持'})`);
      console.log(`  尺寸: ${dims.width}x${dims.height}`);
      console.log(`  dataUrl: ${embedded.dataUrl ? '已生成' : 'null'}`);

      if (!cellImages.has(key)) cellImages.set(key, []);
      cellImages.get(key)!.push(embedded);
      totalImages++;
    }

    console.log(`\n总计: ${totalImages} 张图片`);
    console.log(`分布: ${cellImages.size} 个单元格`);

    // 显示前几个有图片的单元格
    console.log('\n前5个有图片的单元格:');
    let count = 0;
    for (const [key, images] of cellImages.entries()) {
      if (count++ >= 5) break;
      console.log(`  单元格 ${key}: ${images.length} 张图片`);
    }

  } catch (err) {
    console.error('图片提取错误:', err);
  }
}

testTransform().catch(console.error);
