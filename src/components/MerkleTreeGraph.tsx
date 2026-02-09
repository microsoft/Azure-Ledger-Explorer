/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, makeStyles, tokens, Text, Tooltip } from '@fluentui/react-components';
import {
  computeCcfInternalTreeRoot,
  decodeCcfInternalTree,
  formatCcfInternalTreeSummary,
  toHexStringLower,
} from '@microsoft/ccf-ledger-parser';

type NodeId = string;

type GraphNode = {
  id: NodeId;
  hash: Uint8Array;
  level: number; // 0 = leaves
  pos: number; // position within level array
  label?: string;
};

type GraphEdge = {
  from: NodeId;
  to: NodeId;
};

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  graphContainer: {
    flex: '1 1 0',
    minHeight: 0,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: 'auto',
    display: 'flex',
    // Important: do not vertically center inside a scroll container.
    // It can produce incorrect scroll extents and make the vertical scrollbar feel "stuck".
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: tokens.spacingVerticalM,
  },
  canvas: {
    flex: '0 0 auto',
  },
  svg: {
    display: 'block',
  },
  mono: {
    fontFamily: 'Consolas, "Courier New", monospace',
  },
  nodeText: {
    fontFamily: 'Consolas, "Courier New", monospace',
  },
  clickable: {
    cursor: 'pointer',
  },
  leafList: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingVerticalS,
    overflow: 'auto',
    maxHeight: '220px',
  },
  leafRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
  },
  leafHash: {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
  },
  summary: {
    flex: '0 0 auto',
    minHeight: 0,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingVerticalS,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'pre-wrap',
    maxHeight: '200px',
    overflow: 'auto',
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    padding: tokens.spacingVerticalS,
  },
});

const truncateHex = (hash: Uint8Array, chars = 12): string => {
  const hex = toHexStringLower(hash);
  return hex.length <= chars ? hex : `${hex.slice(0, chars)}…`;
};

const buildGraphFromDecoded = async (decoded: ReturnType<typeof decodeCcfInternalTree>) => {
  // Reconstruct using the same logic as computeCcfInternalTreeRoot, but keep all intermediate nodes.
  // This mirrors merklecpp: if bit of minIndex is set at a level, prepend a left sibling from extra hashes.

  const leaves = decoded.leafHashes.slice();
  let levelHashes: Uint8Array[] = leaves;

  let it = decoded.minIndex;
  let extraIndex = 0;

  const nodesByLevel: GraphNode[][] = [];
  const edges: GraphEdge[] = [];
  let nodeCounter = 0;

  const mkNode = (level: number, pos: number, hash: Uint8Array, label?: string): GraphNode => ({
    id: `n${nodeCounter++}`,
    level,
    pos,
    hash,
    label,
  });

  // Level 0 nodes (leaves)
  const leafNodes: GraphNode[] = [];
  for (let i = 0; i < leaves.length; i++) {
    const indexLabel = (decoded.minIndex + BigInt(i)).toString();
    leafNodes.push(mkNode(0, i, leaves[i], indexLabel));
  }
  nodesByLevel.push(leafNodes);

  let currentLevel = 0;

  // Helper to ensure we have a node list for a given level.
  const ensureLevel = (lvl: number) => {
    while (nodesByLevel.length <= lvl) nodesByLevel.push([]);
  };

  // We build upwards until root conditions match merklecpp loop.
  while (it !== 0n || levelHashes.length > 1) {
    currentLevel++;

    // If there is a flushed left edge at this level, prepend the extra hash.
    if ((it & 1n) === 1n) {
      if (extraIndex >= decoded.extraHashes.length) {
        // Cannot fully reconstruct; still return partial graph.
        break;
      }

      const extraHash = decoded.extraHashes[extraIndex++];
      levelHashes = [extraHash, ...levelHashes];

      // Also reflect this extra node in node list at previous level.
      // Keep stable IDs (never rewrite ids), only update `pos` for layout.
      ensureLevel(currentLevel - 1);
      const prevLevelNodes = nodesByLevel[currentLevel - 1];
      const extraNode = mkNode(currentLevel - 1, 0, extraHash, 'extra');
      nodesByLevel[currentLevel - 1] = [extraNode, ...prevLevelNodes].map((n, idx) => ({
        ...n,
        pos: idx,
      }));
    }

    // Build parent level
    const nextHashes: Uint8Array[] = [];
    ensureLevel(currentLevel);

    const prevNodes = nodesByLevel[currentLevel - 1];
    const parentNodes: GraphNode[] = [];

    const sha256 = async (data: Uint8Array): Promise<Uint8Array> => {
      const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
      return new Uint8Array(digest);
    };

    const concatTwo = (left: Uint8Array, right: Uint8Array): Uint8Array => {
      const combined = new Uint8Array(left.length + right.length);
      combined.set(left, 0);
      combined.set(right, left.length);
      return combined;
    };

    for (let i = 0, parentPos = 0; i < levelHashes.length; i += 2, parentPos++) {
      if (i + 1 >= levelHashes.length) {
        // carry
        nextHashes.push(levelHashes[i]);
        const parent = mkNode(currentLevel, parentPos, levelHashes[i]);
        parentNodes.push(parent);

        const leftNode = prevNodes[i];
        if (leftNode) edges.push({ from: leftNode.id, to: parent.id });
      } else {
        const combined = concatTwo(levelHashes[i], levelHashes[i + 1]);
        const parentHash = await sha256(combined);
        nextHashes.push(parentHash);
        const parent = mkNode(currentLevel, parentPos, parentHash);
        parentNodes.push(parent);

        const leftNode = prevNodes[i];
        const rightNode = prevNodes[i + 1];
        if (leftNode) edges.push({ from: leftNode.id, to: parent.id });
        if (rightNode) edges.push({ from: rightNode.id, to: parent.id });
      }
    }

    nodesByLevel[currentLevel] = parentNodes;
    levelHashes = nextHashes;
    it >>= 1n;
  }

  const root = await computeCcfInternalTreeRoot(decoded);

  return { nodesByLevel, edges, root };
};

export const MerkleTreeGraph: React.FC<{ value: Uint8Array }> = ({ value }) => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<string>('');
  const [hoveredNodeId, setHoveredNodeId] = React.useState<NodeId | null>(null);
  const [showLeafList, setShowLeafList] = React.useState(false);
  const [graph, setGraph] = React.useState<{
    nodesByLevel: GraphNode[][];
    edges: GraphEdge[];
    root: Uint8Array | null;
  } | null>(null);

  const [decodedForList, setDecodedForList] = React.useState<ReturnType<typeof decodeCcfInternalTree> | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        const decoded = decodeCcfInternalTree(value);
        const g = await buildGraphFromDecoded(decoded);
        const pretty = formatCcfInternalTreeSummary(decoded, g.root);
        if (!cancelled) {
          setGraph(g);
          setDecodedForList(decoded);
          setSummary(pretty);
        }
      } catch (e) {
        if (!cancelled) {
          setGraph(null);
          setDecodedForList(null);
          setSummary('');
          setError(String(e));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (error) {
    return (
      <div className={styles.root}>
        <Text className={styles.error}>{error}</Text>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className={styles.root}>
        <Text>Loading Merkle tree…</Text>
      </div>
    );
  }

  const leafCount = graph.nodesByLevel[0]?.length ?? 0;
  const manyLeaves = leafCount > 24;

  // Reduce label overlap when there are many leaves.
  // Always show first/last labels, and every Nth label in between.
  const labelStep = manyLeaves ? Math.max(2, Math.ceil(leafCount / 12)) : 1;

  // Simple SVG layout
  const levelCount = graph.nodesByLevel.length;
  const nodeRadius = 14;
  const xGap = 96;
  const yGap = 84;
  const padding = 48;

  const levelWidths = graph.nodesByLevel.map((lvl) => Math.max(1, lvl.length));
  const maxWidthNodes = Math.max(...levelWidths);

  const svgWidth = padding * 2 + (maxWidthNodes - 1) * xGap + nodeRadius * 2;
  const svgHeight = padding * 2 + (levelCount - 1) * yGap + nodeRadius * 2;

  const nodePositions = new Map<NodeId, { x: number; y: number; node: GraphNode }>();

  for (let lvl = 0; lvl < levelCount; lvl++) {
    const nodes = graph.nodesByLevel[lvl];
    const width = Math.max(1, nodes.length);
    const levelLeft = padding + (maxWidthNodes - width) * (xGap / 2);

    for (const n of nodes) {
      const x = levelLeft + n.pos * xGap + nodeRadius;
      const y = svgHeight - padding - lvl * yGap - nodeRadius;
      nodePositions.set(n.id, { x, y, node: n });
    }
  }

  const stroke = tokens.colorNeutralStroke2;
  const nodeFill = tokens.colorNeutralBackground1;
  const nodeStroke = tokens.colorNeutralStroke1;
  const textColor = tokens.colorNeutralForeground2;

  const highlightStroke = tokens.colorBrandStroke1;

  // Build a parent map from child->parent for path highlighting.
  // In this reconstructed tree each node should have at most one parent.
  const parentByChild = new Map<NodeId, NodeId>();
  for (const e of graph.edges) {
    if (!parentByChild.has(e.from)) {
      parentByChild.set(e.from, e.to);
    }
  }

  const highlightedNodes = new Set<NodeId>();
  const highlightedEdges = new Set<string>();
  if (hoveredNodeId) {
    let cur: NodeId | undefined = hoveredNodeId;
    while (cur !== undefined) {
      highlightedNodes.add(cur);
      const parent = parentByChild.get(cur);
      if (!parent) break;
      highlightedNodes.add(parent);
      highlightedEdges.add(`${cur}->${parent}`);
      cur = parent;
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <Text>
          Merkle tree segment ({leafCount} leaf{leafCount === 1 ? '' : 'ves'})
        </Text>
        {manyLeaves && (
          <Button
            appearance="subtle"
            onClick={() => setShowLeafList((v) => !v)}
          >
            {showLeafList ? 'Hide leaf list' : 'Show leaf list'}
          </Button>
        )}
      </div>

      <div className={styles.graphContainer}>
        <div className={styles.canvas}>
          <svg width={svgWidth} height={svgHeight} className={styles.svg}>
          {/* edges */}
          {graph.edges.map((e) => {
            const from = nodePositions.get(e.from);
            const to = nodePositions.get(e.to);
            if (!from || !to) return null;

            const isHighlighted = highlightedEdges.has(`${e.from}->${e.to}`);
            return (
              <line
                key={`${e.from}->${e.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isHighlighted ? highlightStroke : stroke}
                strokeWidth={isHighlighted ? 2 : 1}
              />
            );
          })}

          {/* nodes */}
          {Array.from(nodePositions.values()).map(({ x, y, node }) => {
            const fullHex = toHexStringLower(node.hash);
            const short = truncateHex(node.hash);
            const label = node.level === 0 ? node.label : undefined;
            const labelDisplay =
              label && label !== 'extra'
                ? `tx ${label}`
                : label;

            const txSeqNo = label && label !== 'extra' ? Number(label) : null;
            const isTxLink = node.level === 0 && txSeqNo !== null && Number.isFinite(txSeqNo);

            const handleClick = () => {
              if (!isTxLink) return;
              navigate(`/transaction/${txSeqNo}`);
            };

            const handleEnter = () => setHoveredNodeId(node.id);
            const handleLeave = () => setHoveredNodeId((prev) => (prev === node.id ? null : prev));

            const isNodeHighlighted = highlightedNodes.has(node.id);

            const showLeafLabel =
              node.level !== 0
                ? false
                : labelDisplay === 'extra'
                  ? true
                  : node.pos === 0 || node.pos === leafCount - 1 || (labelStep > 0 && node.pos % labelStep === 0);

            return (
              <g key={node.id} transform={`translate(${x}, ${y})`}>
                <Tooltip
                  content={
                    <div className={styles.mono}>
                      <div>
                        {label
                          ? label === 'extra'
                            ? 'extra (left-edge sibling)'
                            : `leaf tx seqno ${label}`
                          : `level ${node.level}`}
                      </div>
                      <div>{fullHex}</div>
                    </div>
                  }
                  relationship="label"
                >
                  <circle
                    r={nodeRadius}
                    fill={nodeFill}
                    stroke={isNodeHighlighted ? highlightStroke : nodeStroke}
                    strokeWidth={isNodeHighlighted ? 2 : 1}
                    className={isTxLink ? styles.clickable : undefined}
                    onClick={isTxLink ? handleClick : undefined}
                    onMouseEnter={handleEnter}
                    onMouseLeave={handleLeave}
                  />
                </Tooltip>

                <text
                  x={0}
                  y={-nodeRadius - 6}
                  textAnchor="middle"
                  fontSize={12}
                  fill={isNodeHighlighted ? tokens.colorBrandForeground1 : textColor}
                  className={styles.nodeText}
                >
                  {short}
                </text>

                {labelDisplay && showLeafLabel && (
                  <text
                    x={0}
                    y={nodeRadius + 18}
                    textAnchor="middle"
                    fontSize={12}
                    fill={isNodeHighlighted ? tokens.colorBrandForeground1 : textColor}
                    className={isTxLink ? styles.clickable : undefined}
                    onClick={isTxLink ? handleClick : undefined}
                    onMouseEnter={handleEnter}
                    onMouseLeave={handleLeave}
                  >
                    {labelDisplay}
                  </text>
                )}
              </g>
            );
          })}
          </svg>
        </div>
      </div>

      {showLeafList && decodedForList && decodedForList.leafHashes.length > 0 && (
        <div className={styles.leafList}>
          {decodedForList.leafHashes.map((hash, i) => {
            const seqNo = decodedForList.minIndex + BigInt(i);
            const hashHex = toHexStringLower(hash);
            const shortHash = truncateHex(hash, 16);
            return (
              <div key={seqNo.toString()} className={styles.leafRow}>
                <Button appearance="subtle" onClick={() => navigate(`/transaction/${seqNo.toString()}`)}>
                  tx {seqNo.toString()}
                </Button>
                <Tooltip content={<div className={styles.mono}>{hashHex}</div>} relationship="label">
                  <span className={styles.leafHash}>{shortHash}</span>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.summary}>{summary}</div>
    </div>
  );
};
