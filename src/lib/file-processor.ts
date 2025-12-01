import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export class FileProcessor {
  static async processPDF(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import('pdfjs-dist');
      
      // Configure worker for safe, local operation
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        // Security settings for local processing
        disableFontFace: true,
        disableRange: true,
        disableStream: true,
      }).promise;
      
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: unknown) => {
            // Handle different item types safely
            if (typeof item === 'object' && item && 'str' in item) {
              return (item as { str: string }).str;
            }
            return '';
          })
          .join(' ');
        
        if (pageText.trim()) {
          fullText += `${pageText.trim()}\n`;
        }
      }

      return fullText.trim() || 'No readable text found in PDF';
    } catch (error) {
      console.error('Error reading PDF:', error);
      return 'Error extracting text from PDF file. The PDF may be encrypted, corrupted, or contain only images.';
    }
  }

  static async processDOCX(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value.trim() || 'No text content found in DOCX';
    } catch (error) {
      console.error('Error reading DOCX:', error);
      return 'Error extracting text from DOCX file';
    }
  }

  static async processExcel(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      let fullText = '';
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        fullText += `Sheet: ${sheetName}\n${csvText}\n\n`;
      });
      
      return fullText.trim() || 'No data found in Excel file';
    } catch (error) {
      console.error('Error reading Excel:', error);
      return 'Error extracting data from Excel file';
    }
  }

  static async processTextFile(file: File): Promise<string> {
    try {
      return await file.text();
    } catch (error) {
      console.error('Error processing text file:', error);
      return 'Error reading text file';
    }
  }

  static async processImageFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read image file'));
        }
      };
      
      reader.onerror = () => reject(new Error('Error reading image file'));
      reader.readAsDataURL(file);
    });
  }
}
