/**
 * A/B Test Diagram
 *
 * Visual representation of how A/B testing works:
 * - Users split into two groups
 * - Each group gets a different variant
 * - Simple, clear flow
 */

export default function ABTestDiagram() {
  return (
    <svg viewBox="0 0 300 120" className="w-full h-auto">
      {/* Users Box */}
      <rect x="20" y="50" width="60" height="30" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="2" rx="4" />
      <text x="50" y="70" textAnchor="middle" className="fill-gray-700 dark:fill-gray-300" fontSize="12" fontWeight="600">
        Users
      </text>

      {/* Random Split */}
      <path d="M 80 65 L 110 65" stroke="#6B7280" strokeWidth="2" markerEnd="url(#arrowgray)" />
      <text x="95" y="60" textAnchor="middle" className="fill-gray-500" fontSize="10">
        random
      </text>

      {/* Split Arrow */}
      <path d="M 110 65 L 130 35" stroke="#6B7280" strokeWidth="2" markerEnd="url(#arrowblue)" />
      <path d="M 110 65 L 130 95" stroke="#6B7280" strokeWidth="2" markerEnd="url(#arrowgreen)" />

      {/* Control Group */}
      <rect x="130" y="20" width="140" height="30" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" rx="4" />
      <text x="200" y="32" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize="11" fontWeight="600">
        Control (50%)
      </text>
      <text x="200" y="44" textAnchor="middle" className="fill-blue-600 dark:fill-blue-400" fontSize="9">
        Original experience
      </text>

      {/* Treatment Group */}
      <rect x="130" y="80" width="140" height="30" fill="#D1FAE5" stroke="#10B981" strokeWidth="2" rx="4" />
      <text x="200" y="92" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="11" fontWeight="600">
        Treatment (50%)
      </text>
      <text x="200" y="104" textAnchor="middle" className="fill-green-600 dark:fill-green-400" fontSize="9">
        New experience
      </text>

      {/* Arrow Markers */}
      <defs>
        <marker id="arrowgray" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#6B7280" />
        </marker>
        <marker id="arrowblue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#3B82F6" />
        </marker>
        <marker id="arrowgreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#10B981" />
        </marker>
      </defs>
    </svg>
  );
}
