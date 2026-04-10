export default function Loading({ text = 'Loading data...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <div className="w-8 h-8 border-2 border-pharma-200 border-t-pharma-600 rounded-full animate-spin mb-3" />
      <span className="text-sm">{text}</span>
    </div>
  );
}
