import Image from "next/image";

// Multiply blends each photo's background into the shared surface so the set reads as one shelf.
export function ProductImage({
  src,
  alt,
  sizes,
  preload = false,
  unavailable = false,
  className = "",
}: {
  src: string | null;
  alt: string;
  sizes: string;
  preload?: boolean;
  unavailable?: boolean;
  className?: string;
}) {
  return (
    <div className={`aspect-[3/2] overflow-hidden rounded-image bg-well ${className}`}>
      {src && (
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={800}
          sizes={sizes}
          preload={preload}
          className={`size-full object-cover mix-blend-multiply ${unavailable ? "opacity-60 grayscale" : ""}`}
        />
      )}
    </div>
  );
}
