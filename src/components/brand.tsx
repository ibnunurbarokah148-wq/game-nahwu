import Link from "next/link";

export function Brand() {
  return <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">ن</span><span>Game Kuis<small>Tim Kartu</small></span></Link>;
}
