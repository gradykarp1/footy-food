export interface ImageData {
  base64: string;
  mediaType: string;
  preview: string;
}

/**
 * Downscale to 1024px wide and re-encode as JPEG before upload. Keeps request
 * size and vision-token cost down; well within Sonnet 5's 2576px high-res tier.
 */
export function compressAndConvertImage(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        const maxWidth = 1024;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({
          base64: dataUrl.split(",")[1],
          preview: dataUrl,
          mediaType: "image/jpeg",
        });
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** 64px center-cropped thumbnail — the only image form that gets persisted. */
export function createThumbnail(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve("");
        return;
      }

      const size = 64;
      canvas.width = size;
      canvas.height = size;

      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };

    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}
