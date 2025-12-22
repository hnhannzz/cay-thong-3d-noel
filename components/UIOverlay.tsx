import React, { useRef, useState } from 'react';
import { TreeMode } from '../types';

interface UIOverlayProps {
  mode: TreeMode;
  onToggle: () => void;
  onPhotosUpload: (photos: string[]) => void;
  hasPhotos: boolean;
  uploadedPhotos: string[];
  isSharedView: boolean;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ mode, onToggle, onPhotosUpload, hasPhotos, uploadedPhotos, isSharedView }) => {
  const isFormed = mode === TreeMode.FORMED;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [shareError, setShareError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const photoUrls: string[] = [];
    const readers: Promise<string>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const promise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            resolve(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      });

      readers.push(promise);
    }

    Promise.all(readers).then((urls) => {
      onPhotosUpload(urls);
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Helper function to convert base64 to Blob
  const base64ToBlob = (base64: string): Blob => {
    const byteString = atob(base64.split(',')[1]);
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  const handleShare = async () => {
    if (!uploadedPhotos || uploadedPhotos.length === 0) {
      setShareError('Vui lòng tải ảnh lên trước');
      return;
    }

    setIsSharing(true);
    setShareError('');
    setShareLink('');
    setUploadProgress('Đang chuẩn bị...');

    try {
      // Step 1: Get presigned upload URLs from server
      setUploadProgress('Đang lấy địa chỉ tải lên...');
      const urlsResponse = await fetch('/api/get-upload-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageCount: uploadedPhotos.length,
        }),
      });

      // Check for valid JSON response (Vite returns HTML for 404s/API routes locally)
      const contentType = urlsResponse.headers.get('content-type');
      if (urlsResponse.status === 404 || !contentType || !contentType.includes('application/json')) {
         throw new Error('API_ROUTE_MISSING');
      }

      const urlsData = await urlsResponse.json();

      if (!urlsResponse.ok) {
        throw new Error(urlsData.error || 'Lấy địa chỉ tải lên thất bại');
      }

      const { shareId, uploadUrls } = urlsData;

      // Step 2: Upload images directly to R2 using presigned URLs
      setUploadProgress(`Đang Tải Ảnh Lên (0/${uploadedPhotos.length})...`);
      
      let uploadedCount = 0;
      const uploadPromises = uploadedPhotos.map(async (photo, index) => {
        const blob = base64ToBlob(photo);
        const { uploadUrl, publicUrl } = uploadUrls[index];

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': 'image/jpeg',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Tải ảnh thứ ${index + 1} thất bại`);
        }

        uploadedCount++;
        setUploadProgress(`Đang Tải Ảnh Lên (${uploadedCount}/${uploadedPhotos.length})...`);
        return publicUrl;
      });

      const imageUrls = await Promise.all(uploadPromises);

      // Step 3: Complete the upload by storing metadata in KV
      setUploadProgress('Đang tạo liên kết...');
      const completeResponse = await fetch('/api/complete-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareId,
          imageUrls,
        }),
      });

      // Check JSON response for completion
      const completeContentType = completeResponse.headers.get('content-type');
      if (!completeContentType || !completeContentType.includes('application/json')) {
         throw new Error('API_ROUTE_MISSING');
      }

      const completeData = await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(completeData.error || 'Lưu thông tin chia sẻ thất bại');
      }

      setShareLink(completeData.shareLink);
    } catch (error: any) {
      console.error('Share error:', error);
      
      // Fallback to localStorage for network errors or missing API routes (Local Dev)
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');
      
      if (isLocalDev && (
        error.message?.includes('Failed to fetch') || 
        error.name === 'TypeError' || 
        error.message === 'API_ROUTE_MISSING' ||
        error.name === 'SyntaxError'
      )) {
        try {
          console.log('Network/API error, using localStorage fallback');
          const shareId = Math.random().toString(36).substring(2, 10);
          const shareData = {
            images: uploadedPhotos,
            createdAt: Date.now(),
          };
          localStorage.setItem(`share_${shareId}`, JSON.stringify(shareData));
          const shareLink = `${window.location.origin}/?share=${shareId}`;
          setShareLink(shareLink);
          return;
        } catch (storageError: any) {
          setShareError('Ảnh quá lớn, vui lòng giảm số lượng hoặc kích thước');
          return;
        }
      }
      
      setShareError(error.message || 'Chia sẻ thất bại, vui lòng thử lại');
    } finally {
      setIsSharing(false);
      setUploadProgress('');
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleCreateMine = () => {
    // Clear URL params and reload
    window.location.href = window.location.origin;
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
      
      {/* Header */}
      <header className="absolute top-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F5E6BF] to-[#D4AF37] font-serif drop-shadow-lg tracking-wider text-center">
          Merry Christmas
        </h1>
      </header>

      {/* Right Bottom Action Area - Moved higher to bottom-32 on mobile */}
      <div className="absolute bottom-32 right-4 md:bottom-8 md:right-8 flex flex-col items-end gap-4 pointer-events-auto">
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Shared View: Show "制作我的圣诞树" button */}
        {isSharedView && (
          <button
            onClick={handleCreateMine}
            className="group px-6 py-3 border-2 border-[#D4AF37] bg-black/70 backdrop-blur-md overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_#D4AF37] hover:border-[#fff] hover:bg-[#D4AF37]/20"
          >
            <span className="relative z-10 font-serif text-base md:text-lg text-[#D4AF37] tracking-[0.1em] group-hover:text-white transition-colors whitespace-nowrap">
              Tạo Cây Của Tôi
            </span>
          </button>
        )}

        {/* Not Shared View: Show upload and share controls */}
        {!isSharedView && (
          <>
            {/* Upload Button - Show when no photos */}
            {!hasPhotos && (
              <button
                onClick={handleUploadClick}
                className="group px-6 py-3 border-2 border-[#D4AF37] bg-black/70 backdrop-blur-md overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_#D4AF37] hover:border-[#fff] hover:bg-[#D4AF37]/20"
              >
                <span className="relative z-10 font-serif text-base md:text-lg text-[#D4AF37] tracking-[0.1em] group-hover:text-white transition-colors whitespace-nowrap">
                  Upload Ảnh
                </span>
              </button>
            )}

            {/* Share Button - Show when photos are uploaded but link not generated */}
            {hasPhotos && !shareLink && (
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  className="group px-6 py-3 border-2 border-[#D4AF37] bg-black/70 backdrop-blur-md overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_#D4AF37] hover:border-[#fff] hover:bg-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 font-serif text-base md:text-lg text-[#D4AF37] tracking-[0.1em] group-hover:text-white transition-colors whitespace-nowrap">
                    {uploadProgress || (isSharing ? 'Đang tạo...' : 'Chia Sẻ')}
                  </span>
                </button>
                {shareError && (
                  <p className="text-red-400 text-xs font-serif text-right">{shareError}</p>
                )}
              </div>
            )}

            {/* Share Link Display - Show after link is generated */}
            {shareLink && (
              <div className="bg-black/80 backdrop-blur-md border-2 border-[#D4AF37] p-4 max-w-sm">
                <p className="text-[#F5E6BF] font-serif text-sm mb-2">Liên kết chia sẻ đã sẵn sàng</p>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 bg-black/50 text-[#D4AF37] px-3 py-2 text-xs border border-[#D4AF37]/30 font-mono"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 border border-[#D4AF37] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 transition-colors shrink-0"
                  >
                    <span className="text-[#D4AF37] text-xs font-serif whitespace-nowrap">
                      {copied ? '✓ Đã chép' : 'Sao chép'}
                    </span>
                  </button>
                </div>
                <p className="text-[#F5E6BF]/50 text-xs font-serif">
                  Hết hạn sau 30 ngày
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Decorative Corners */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-[#D4AF37] opacity-50"></div>
    </div>
  );
};