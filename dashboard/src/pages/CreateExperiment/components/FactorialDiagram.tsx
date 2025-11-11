/**
 * Factorial Design Diagram
 *
 * Visual representation of a 2x2 factorial design showing:
 * - Factor A (rows) and Factor B (columns)
 * - All 4 combinations
 * - How factors interact
 */

export default function FactorialDiagram() {
  return (
    <svg viewBox="0 0 300 140" className="w-full h-auto">
      {/* Title */}
      <text x="150" y="15" textAnchor="middle" className="fill-gray-700 dark:fill-gray-300" fontSize="12" fontWeight="600">
        2×2 Factorial: Factor A × Factor B
      </text>

      {/* Factor B Label (Top) */}
      <text x="125" y="35" textAnchor="middle" className="fill-gray-600 dark:fill-gray-400" fontSize="10">
        Factor B₀
      </text>
      <text x="225" y="35" textAnchor="middle" className="fill-gray-600 dark:fill-gray-400" fontSize="10">
        Factor B₁
      </text>

      {/* Factor A Label (Left) */}
      <text x="30" y="65" textAnchor="middle" className="fill-gray-600 dark:fill-gray-400" fontSize="10" transform="rotate(-90 30 65)">
        Factor A₀
      </text>
      <text x="30" y="115" textAnchor="middle" className="fill-gray-600 dark:fill-gray-400" fontSize="10" transform="rotate(-90 30 115)">
        Factor A₁
      </text>

      {/* Cell 1: A₀B₀ (Control) */}
      <rect x="70" y="45" width="80" height="35" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" rx="4" />
      <text x="110" y="60" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize="11" fontWeight="600">
        A₀B₀
      </text>
      <text x="110" y="72" textAnchor="middle" className="fill-blue-600 dark:fill-blue-400" fontSize="8">
        (25% users)
      </text>

      {/* Cell 2: A₀B₁ */}
      <rect x="170" y="45" width="80" height="35" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" rx="4" />
      <text x="210" y="60" textAnchor="middle" className="fill-yellow-700 dark:fill-yellow-300" fontSize="11" fontWeight="600">
        A₀B₁
      </text>
      <text x="210" y="72" textAnchor="middle" className="fill-yellow-600 dark:fill-yellow-400" fontSize="8">
        (25% users)
      </text>

      {/* Cell 3: A₁B₀ */}
      <rect x="70" y="95" width="80" height="35" fill="#FED7AA" stroke="#EA580C" strokeWidth="2" rx="4" />
      <text x="110" y="110" textAnchor="middle" className="fill-orange-700 dark:fill-orange-300" fontSize="11" fontWeight="600">
        A₁B₀
      </text>
      <text x="110" y="122" textAnchor="middle" className="fill-orange-600 dark:fill-orange-400" fontSize="8">
        (25% users)
      </text>

      {/* Cell 4: A₁B₁ */}
      <rect x="170" y="95" width="80" height="35" fill="#D1FAE5" stroke="#10B981" strokeWidth="2" rx="4" />
      <text x="210" y="110" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="11" fontWeight="600">
        A₁B₁
      </text>
      <text x="210" y="122" textAnchor="middle" className="fill-green-600 dark:fill-green-400" fontSize="8">
        (25% users)
      </text>

      {/* Grid Lines */}
      <line x1="60" y1="42" x2="260" y2="42" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="60" y1="132" x2="260" y2="132" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="60" y1="42" x2="60" y2="132" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="260" y1="42" x2="260" y2="132" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="160" y1="42" x2="160" y2="132" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="2,2" />
      <line x1="60" y1="87" x2="260" y2="87" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="2,2" />
    </svg>
  );
}
