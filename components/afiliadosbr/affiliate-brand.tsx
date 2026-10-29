import Image from "next/image"

export function AffiliateBrand({ className = "h-7" }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/images/bullion-trader-logo.png"
        alt=""
        width={96}
        height={96}
        priority
        className={`${className} aspect-square w-auto rounded-full object-cover`}
      />
      <span className="font-bold tracking-tight">Bullion Trader</span>
    </span>
  )
}
