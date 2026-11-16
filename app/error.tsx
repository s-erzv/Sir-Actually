"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#05080b] px-4">
      <div className="w-full max-w-md border-2 border-blood bg-[#0a0f14] p-6 text-center shadow-[8px_8px_0_#05080b]">
        <p className="font-pixel text-[0.6rem] text-blood">LORONG RUNTUH</p>
        <h1 className="mt-3 font-pixel text-base text-bone">Ada yang patah di dungeon ini</h1>
        <p className="mt-3 text-sm leading-6 text-ash">
          Progres run kamu tersimpan di server. Coba muat ulang ruangan ini; kalau masih gagal,
          kembali ke markas.
        </p>
        {error.digest ? (
          <p className="mt-3 text-[0.65rem] text-ash/60">Kode: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="border-2 border-gold bg-gold px-4 py-2 font-pixel text-[0.6rem] text-void"
          >
            COBA LAGI
          </button>
          <Link
            href="/dashboard"
            className="border-2 border-ridge px-4 py-2 font-pixel text-[0.6rem] text-bone"
          >
            KE MARKAS
          </Link>
        </div>
      </div>
    </main>
  );
}
