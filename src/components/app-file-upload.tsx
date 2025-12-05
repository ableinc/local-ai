import { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Paperclip, X, File, Image, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { FileProcessor } from '@/lib/file-processor';

export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  content: string;
  uploadedAt: string;
}

interface AppFileUploadProps {
  onFileContent: (files: UploadedFile[]) => void;
  disabled?: boolean;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

export function AppFileUpload({ onFileContent, disabled, uploadedFiles, setUploadedFiles }: AppFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const supportedTypes = {
    'text/plain': 'txt',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    
    try {
      for (const file of files) {
        // Check file type
        if (!Object.keys(supportedTypes).includes(file.type)) {
          toast.error(`Unsupported file type: ${file.name}`, {
            description: 'Supported types: PDF, TXT, DOCX, XLS, XLSX, and images',
            duration: 5000,
          });
          continue;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File too large: ${file.name}`, {
            description: 'Maximum file size is 10MB',
            duration: 5000,
          });
          continue;
        }

        try {
          let content: string;

          // Process different file types using the FileProcessor class
          if (file.type === 'text/plain') {
            content = await FileProcessor.processTextFile(file);
          } else if (file.type.startsWith('image/')) {
            content = await FileProcessor.processImageFile(file);
          } else if (file.type === 'application/pdf') {
            content = await FileProcessor.processPDF(file);
          } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            content = await FileProcessor.processDOCX(file);
          } else if (file.type === 'application/vnd.ms-excel' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            content = await FileProcessor.processExcel(file);
          } else {
            toast.error(`Error processing file: ${file.name}`, {
              description: 'File type not supported for content extraction',
              duration: 5000,
            });
            continue;
          }

          const uploadedFile: UploadedFile = {
            name: file.name,
            type: file.type,
            size: file.size,
            content,
            uploadedAt: new Date().toISOString()
          };

          const updatedFiles = [...uploadedFiles, uploadedFile];
          setUploadedFiles(updatedFiles);
          
          // Send all uploaded files to parent
          onFileContent(updatedFiles);
          
          toast.success(`File uploaded: ${file.name}`, {
            duration: 3000,
          });
          
        } catch (error) {
          console.error('Error processing file:', error);
          toast.error(`Error processing file: ${file.name}`, {
            description: 'Please try again',
            duration: 5000,
          });
        }
      }
    } finally {
      setIsProcessing(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updatedFiles);
    onFileContent(updatedFiles);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleButtonClick}
          disabled={disabled || isProcessing}
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          <Paperclip className="h-4 w-4 mr-1" />
          {isProcessing ? 'Processing...' : 'Attach'}
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.pdf,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <span className="text-xs text-muted-foreground">
          PDF, TXT, DOCX, XLS, XLSX, Images
        </span>
      </div>
      
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {uploadedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-1 bg-muted text-muted-foreground px-2 py-1 rounded text-xs"
            >
              {getFileIcon(file.type)}
              <span className="max-w-[100px] truncate">{file.name}</span>
              <span className="text-xs">({formatFileSize(file.size)})</span>
              <Button
                onClick={() => removeFile(index)}
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
