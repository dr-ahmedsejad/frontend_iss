export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <span className="w-10 h-10 border-4 border-[#006633]/20 border-t-[#006633] rounded-full animate-spin" />
        <p className="text-xs text-iss-gray">Chargement…</p>
      </div>
    </div>
  );
}
