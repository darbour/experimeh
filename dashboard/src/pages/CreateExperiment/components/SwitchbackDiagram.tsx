/**
 * Switchback Design Diagram
 *
 * Visual representation of temporal switching showing:
 * - Time periods on x-axis
 * - Variant assignment alternating over time
 * - All users experience both variants
 */

export default function SwitchbackDiagram() {
  return (
    <svg viewBox="0 0 300 120" className="w-full h-auto">
      {/* Title */}
      <text x="150" y="15" textAnchor="middle" className="fill-gray-700 dark:fill-gray-300" fontSize="12" fontWeight="600">
        Switchback: Time-Based Switching
      </text>

      {/* Time Axis */}
      <line x1="20" y1="100" x2="280" y2="100" stroke="#9CA3AF" strokeWidth="2" markerEnd="url(#arrowtime)" />
      <text x="285" y="105" className="fill-gray-500" fontSize="10">t</text>

      {/* Period Labels */}
      <text x="50" y="115" textAnchor="middle" className="fill-gray-500" fontSize="9">
        Period 1
      </text>
      <text x="110" y="115" textAnchor="middle" className="fill-gray-500" fontSize="9">
        Period 2
      </text>
      <text x="170" y="115" textAnchor="middle" className="fill-gray-500" fontSize="9">
        Period 3
      </text>
      <text x="230" y="115" textAnchor="middle" className="fill-gray-500" fontSize="9">
        Period 4
      </text>

      {/* Period 1: Control */}
      <rect x="25" y="40" width="50" height="50" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" rx="4" />
      <text x="50" y="60" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize="10" fontWeight="600">
        Control
      </text>
      <text x="50" y="73" textAnchor="middle" className="fill-blue-600 dark:fill-blue-400" fontSize="8">
        ALL
      </text>
      <text x="50" y="83" textAnchor="middle" className="fill-blue-600 dark:fill-blue-400" fontSize="8">
        users
      </text>

      {/* Period 2: Treatment */}
      <rect x="85" y="40" width="50" height="50" fill="#D1FAE5" stroke="#10B981" strokeWidth="2" rx="4" />
      <text x="110" y="60" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="10" fontWeight="600">
        Treatment
      </text>
      <text x="110" y="73" textAnchor="middle" className="fill-green-600 dark:fill-green-400" fontSize="8">
        ALL
      </text>
      <text x="110" y="83" textAnchor="middle" className="fill-green-600 dark:fill-green-400" fontSize="8">
        users
      </text>

      {/* Period 3: Control */}
      <rect x="145" y="40" width="50" height="50" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" rx="4" />
      <text x="170" y="60" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize="10" fontWeight="600">
        Control
      </text>
      <text x="170" y="73" textAnchor="middle" className="fill-blue-600 dark:fill-blue-400" fontSize="8">
        ALL
      </text>
      <text x="170" y="83" textAnchor="middle" className="fill-blue-600 dark:fill-blue-400" fontSize="8">
        users
      </text>

      {/* Period 4: Treatment */}
      <rect x="205" y="40" width="50" height="50" fill="#D1FAE5" stroke="#10B981" strokeWidth="2" rx="4" />
      <text x="230" y="60" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="10" fontWeight="600">
        Treatment
      </text>
      <text x="230" y="73" textAnchor="middle" className="fill-green-600 dark:fill-green-400" fontSize="8">
        ALL
      </text>
      <text x="230" y="83" textAnchor="middle" className="fill-green-600 dark:fill-green-400" fontSize="8">
        users
      </text>

      {/* Switching Arrows */}
      <path d="M 75 65 L 85 65" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowswitch)" />
      <path d="M 135 65 L 145 65" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowswitch)" />
      <path d="M 195 65 L 205 65" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowswitch)" />

      {/* Washout Indicator */}
      <rect x="73" y="30" width="4" height="65" fill="#EF4444" opacity="0.3" />
      <rect x="133" y="30" width="4" height="65" fill="#EF4444" opacity="0.3" />
      <rect x="193" y="30" width="4" height="65" fill="#EF4444" opacity="0.3" />
      <text x="75" y="25" textAnchor="middle" className="fill-red-600 dark:fill-red-400" fontSize="7">
        washout
      </text>

      {/* Arrow Markers */}
      <defs>
        <marker id="arrowtime" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#9CA3AF" />
        </marker>
        <marker id="arrowswitch" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L7,3 z" fill="#6B7280" />
        </marker>
      </defs>
    </svg>
  );
}
