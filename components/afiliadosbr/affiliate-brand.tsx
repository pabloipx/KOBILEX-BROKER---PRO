import Image from "next/image"

export function AffiliateBrand({ className = "h-7" }: { className?: string }) {
  return (
    <span className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-2">
      <Image
        src="/images/uryn-bear-logo.png"
        alt="URYN BROKER"
        width={200}
        height={66}
        className={`${className} w-auto`}
        unoptimized
      />
    </span>
  )
}
