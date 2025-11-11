/**
 * Stepped Wedge Design Diagram
 *
 * Visual representation showing:
 * - Clusters (rows) transitioning from control to treatment over time (columns)
 * - Staggered rollout pattern
 * - Everyone eventually gets treatment
 */

export default function SteppedWedgeDiagram() {
  return (
    <svg viewBox="0 0 300 130" className="w-full h-auto">
      {/* Title */}
      <text x="150" y="15" textAnchor="middle" className="fill-gray-700 dark:fill-gray-300" fontSize="12" fontWeight="600">
        Stepped Wedge: Gradual Cluster Rollout
      </text>

      {/* Time Period Headers */}
      <text x="100" y="35" textAnchor="middle" className="fill-gray-600 dark:fill-gray-400" fontSize="9">
        Week 1
      </text>
      <text x="145" y="35" textAnchor="middle" className="fill-gray-600 dark:fill-gray-400" fontSize="9">
        Week 2
      </text>
      <text x="190" y="35" textAnchor="middle" className="fill-gray-600 dark:fill-gray-400" fontSize="9">
        Week 3
      </text>
      <text x="235" y="35" textAnchor="middle" className="fill-gray-600 dark:fill-gray-400" fontSize="9">
        Week 4
      </text>

      {/* Cluster Labels */}
      <text x="20" y="60" className="fill-gray-600 dark:fill-gray-400" fontSize="9">
        Cluster 1
      </text>
      <text x="20" y="82" className="fill-gray-600 dark:fill-gray-400" fontSize="9">
        Cluster 2
      </text>
      <text x="20" y="104" className="fill-gray-600 dark:fill-gray-400" fontSize="9">
        Cluster 3
      </text>
      <text x="20" y="126" className="fill-gray-600 dark:fill-gray-400" fontSize="9">
        Cluster 4
      </text>

      {/* Cluster 1: Control → Treatment @ Week 1 */}
      <rect x="75" y="45" width="35" height="18" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" rx="2" />
      <rect x="120" y="45" width="35" height="18" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" rx="2" />
      <rect x="165" y="45" width="35" height="18" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" rx="2" />
      <rect x="210" y="45" width="35" height="18" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" rx="2" />
      <text x="92.5" y="57" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="8" fontWeight="600">T</text>
      <text x="137.5" y="57" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="8" fontWeight="600">T</text>
      <text x="182.5" y="57" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="8" fontWeight="600">T</text>
      <text x="227.5" y="57" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="8" fontWeight="600">T</text>

      {/* Cluster 2: Control, Control → Treatment @ Week 2 */}
      <rect x="75" y="67" width="35" height="18" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" rx="2" />
      <rect x="120" y="67" width="35" height="18" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" rx="2" />
      <rect x="165" y="67" width="35" height="18" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" rx="2" />
      <rect x="210" y="67" width="35" height="18" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" rx="2" />
      <text x="92.5" y="79" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize="8" fontWeight="600">C</text>
      <text x="137.5" y="79" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="8" fontWeight="600">T</text>
      <text x="182.5" y="79" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="8" fontWeight="600">T</text>
      <text x="227.5" y="79" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="8" fontWeight="600">T</text>

      {/* Cluster 3: Control, Control, Control → Treatment @ Week 3 */}
      <rect x="75" y="89" width="35" height="18" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" rx="2" />
      <rect x="120" y="89" width="35" height="18" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" rx="2" />
      <rect x="165" y="89" width="35" height="18" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" rx="2" />
      <rect x="210" y="89" width="35" height="18" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" rx="2" />
      <text x="92.5" y="101" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize="8" fontWeight="600">C</text>
      <text x="137.5" y="101" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize="8" fontWeight="600">C</text>
      <text x="182.5" y="101" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="8" fontWeight="600">T</text>
      <text x="227.5" y="101" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="8" fontWeight="600">T</text>

      {/* Cluster 4: All Control → Treatment @ Week 4 */}
      <rect x="75" y="111" width="35" height="18" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" rx="2" />
      <rect x="120" y="111" width="35" height="18" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" rx="2" />
      <rect x="165" y="111" width="35" height="18" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" rx="2" />
      <rect x="210" y="111" width="35" height="18" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" rx="2" />
      <text x="92.5" y="123" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize="8" fontWeight="600">C</text>
      <text x="137.5" y="123" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize="8" fontWeight="600">C</text>
      <text x="182.5" y="123" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize="8" fontWeight="600">C</text>
      <text x="227.5" y="123" textAnchor="middle" className="fill-green-700 dark:fill-green-300" fontSize="8" fontWeight="600">T</text>

      {/* Legend */}
      <rect x="255" y="50" width="12" height="12" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1" rx="1" />
      <text x="272" y="59" className="fill-gray-600 dark:fill-gray-400" fontSize="8">Control</text>

      <rect x="255" y="68" width="12" height="12" fill="#D1FAE5" stroke="#10B981" strokeWidth="1" rx="1" />
      <text x="272" y="77" className="fill-gray-600 dark:fill-gray-400" fontSize="8">Treatment</text>
    </svg>
  );
}
