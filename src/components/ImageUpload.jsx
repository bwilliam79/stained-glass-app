import { useRef, useState } from 'react';

export default function ImageUpload({ imageUrl, onImageSelected }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file) {
    if (file && file.type.startsWith('image/')) {
      onImageSelected(file);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Source Image</h2>

      {imageUrl ? (
        <div className="relative group">
          <img
            src={imageUrl}
            alt="Source"
            className="w-full rounded-lg object-contain max-h-48 bg-gray-100"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
            <button
              onClick={() => inputRef.current.click()}
              className="bg-white text-gray-800 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Replace Image
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-amber-500 bg-amber-50'
              : 'border-gray-300 hover:border-amber-400 hover:bg-gray-50'
          }`}
        >
          <div className="text-4xl mb-3">🖼️</div>
          <p className="text-sm font-medium text-gray-700">Drop an image here</p>
          <p className="text-xs text-gray-500 mt-1">or click to browse</p>
          <p className="text-xs text-gray-400 mt-2">PNG, JPG, WebP, GIF</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files[0])}
      />

      {imageUrl && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Click the image to replace it
        </p>
      )}
    </div>
  );
}
