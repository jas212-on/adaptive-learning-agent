"""
Concept graph builder with Gemini-powered subtopic expansion.

Builds a hierarchical graph from detected topics, expanding subtopics
up to a configurable depth using Gemini AI with caching.
"""
from __future__ import annotations
import json
import hashlib
import re
from pathlib import Path
from typing import Any

from .models import GraphNode, GraphEdge, ConceptGraph, NodeKind


# Cache file for subtopic expansions
CACHE_FILE = Path(__file__).parent.parent / "graph_cache.json"


def _load_cache() -> dict[str, list[str]]:
    """Load cached subtopic expansions."""
    if CACHE_FILE.exists():
        try:
            with CACHE_FILE.open("r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_cache(cache: dict[str, list[str]]) -> None:
    """Save subtopic expansions to cache."""
    try:
        with CACHE_FILE.open("w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
    except OSError:
        pass  # Non-critical, continue without caching


def _cache_key(topic: str) -> str:
    """Generate a cache key for a topic."""
    normalized = topic.lower().strip()
    return hashlib.md5(normalized.encode()).hexdigest()[:16]


def _sanitize_id(text: str) -> str:
    """Convert text to a valid node ID."""
    # Remove special characters, replace spaces with underscores
    sanitized = re.sub(r"[^\w\s-]", "", text.lower())
    sanitized = re.sub(r"\s+", "_", sanitized.strip())
    return sanitized[:50] or "node"


def _expand_subtopics_with_gemini(topic: str, max_subtopics: int = 5) -> list[str]:
    """
    Use Gemini to expand a topic into subtopics.
    
    Returns cached results if available, otherwise queries Gemini.
    """
    cache = _load_cache()
    key = _cache_key(topic)
    
    if key in cache:
        return cache[key][:max_subtopics]
    
    # Try to use Gemini
    try:
        from llm.gemini import ask_gemini
        
        prompt = (
            f"List exactly {max_subtopics} key subtopics or components of '{topic}' "
            f"that a student should learn. Return ONLY a JSON array of strings, "
            f"each subtopic being 2-5 words. Example format: [\"subtopic1\", \"subtopic2\"]\n\n"
            f"Topic: {topic}"
        )
        
        response = ask_gemini(prompt).strip()
        
        # Parse JSON response
        # Handle markdown code blocks
        if "```" in response:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", response)
            if match:
                response = match.group(1).strip()
        
        subtopics = json.loads(response)
        
        if isinstance(subtopics, list) and all(isinstance(s, str) for s in subtopics):
            subtopics = [s.strip() for s in subtopics if s.strip()][:max_subtopics]
            
            # Cache the result
            cache[key] = subtopics
            _save_cache(cache)
            
            return subtopics
        
    except Exception:
        # Gemini unavailable or parsing failed
        pass
    
    return []


def _extract_subtopics_from_detected(detected_concepts: list[dict[str, Any]]) -> list[str]:
    """
    Extract subtopic names from detected concepts.
    
    detected_concepts format: [{"name": "...", "confidence": ...}, ...]
    """
    subtopics = []
    for concept in detected_concepts:
        if isinstance(concept, dict):
            name = concept.get("name") or concept.get("title") or concept.get("label")
            if name and isinstance(name, str):
                subtopics.append(name.strip())
        elif isinstance(concept, str):
            subtopics.append(concept.strip())
    
    return [s for s in subtopics if s]


def build_concept_graph(
    topic_id: str,
    topic_title: str,
    detected_concepts: list[dict[str, Any]] | None = None,
    max_depth: int = 2,
    max_children: int = 5,
    use_gemini_fallback: bool = True,
) -> ConceptGraph:
    """
    Build a concept dependency graph from a detected topic.
    
    Args:
        topic_id: Unique identifier of the root topic
        topic_title: Display title of the root topic  
        detected_concepts: Pre-detected subtopics (from OCR)
        max_depth: Maximum depth of subtopic expansion (0-2)
        max_children: Maximum children per node
        use_gemini_fallback: Whether to use Gemini when detected_concepts is empty
        
    Returns:
        ConceptGraph with nodes and edges
    """
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    visited: set[str] = set()  # Cycle prevention
    
    max_depth = max(0, min(max_depth, 2))  # Clamp to 0-2
    
    # Create root node
    root_node = GraphNode(
        id=topic_id,
        label=topic_title,
        kind="core",
        depth=0,
        parent_id=None
    )
    nodes.append(root_node)
    visited.add(topic_id)
    
    def _expand_node(
        parent_id: str,
        parent_label: str,
        current_depth: int,
        subtopics: list[str] | None = None
    ) -> None:
        """Recursively expand a node with subtopics."""
        if current_depth > max_depth:
            return
        
        # Get subtopics for this node
        if subtopics is None:
            if use_gemini_fallback:
                subtopics = _expand_subtopics_with_gemini(parent_label, max_children)
            else:
                subtopics = []
        
        # Determine node kind based on depth
        child_kind: NodeKind = "subtopic" if current_depth == 1 else "detail"
        
        for i, subtopic_name in enumerate(subtopics[:max_children]):
            # Generate unique ID
            base_id = _sanitize_id(subtopic_name)
            node_id = f"{parent_id}_{base_id}"
            
            # Handle duplicates
            counter = 1
            original_id = node_id
            while node_id in visited:
                node_id = f"{original_id}_{counter}"
                counter += 1
            
            visited.add(node_id)
            
            # Create node
            node = GraphNode(
                id=node_id,
                label=subtopic_name,
                kind=child_kind,
                depth=current_depth,
                parent_id=parent_id
            )
            nodes.append(node)
            
            # Create edge from parent to child
            edge = GraphEdge(
                source=parent_id,
                target=node_id,
                relation="contains"
            )
            edges.append(edge)
            
            # Recursively expand if not at max depth
            if current_depth < max_depth:
                _expand_node(node_id, subtopic_name, current_depth + 1)
    
    # Start expansion from root
    initial_subtopics = None
    if detected_concepts:
        initial_subtopics = _extract_subtopics_from_detected(detected_concepts)
    
    if max_depth > 0:
        _expand_node(topic_id, topic_title, 1, initial_subtopics)
    
    # Calculate actual max depth reached
    actual_max_depth = max(n.depth for n in nodes) if nodes else 0
    
    return ConceptGraph(
        nodes=nodes,
        edges=edges,
        root_id=topic_id,
        max_depth=actual_max_depth
    )


def graph_to_legacy_format(graph: ConceptGraph) -> dict[str, Any]:
    """
    Convert ConceptGraph to the legacy format expected by frontend.
    
    Legacy format:
    {
        "nodes": [{"id": "...", "label": "...", "kind": "..."}],
        "edges": [{"from": "...", "to": "..."}]
    }
    """
    return {
        "nodes": [
            {
                "id": node.id,
                "label": node.label,
                "kind": node.kind,
                "depth": node.depth,
                "parentId": node.parent_id
            }
            for node in graph.nodes
        ],
        "edges": [
            {
                "from": edge.source,
                "to": edge.target,
                "relation": edge.relation
            }
            for edge in graph.edges
        ],
        "rootId": graph.root_id,
        "maxDepth": graph.max_depth
    }
