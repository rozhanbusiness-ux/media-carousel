import React, { useRef } from 'react';

interface Props {
  onFile: (f: File) => void;
  disabled?: boolean;
}

const ACCEPTED = 'application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/gif';

export function UploadZone({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.type.startsWith('image/'))) onFile(file);
  };

  return (
    <div
      className="upload-zone"
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <span>📄 PDF oder 🖼️ Screenshot hier ablegen oder klicken</span>
      <small style={{ display: 'block', opacity: 0.6, marginTop: 4 }}>PDF, JPG, PNG, WEBP</small>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        hidden
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
