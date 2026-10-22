import Image from "next/image";

export function BrandIcon({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/icons/gradeshelf-192.png"
      alt=""
      width={size}
      height={size}
      loading="eager"
      className="shrink-0 rounded-xl"
    />
  );
}
