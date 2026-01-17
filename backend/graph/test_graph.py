"""
Tests for the concept graph builder.
"""
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from graph.builder import (
    build_concept_graph,
    graph_to_legacy_format,
    _sanitize_id,
    _extract_subtopics_from_detected,
)


def test_sanitize_id():
    """Test ID sanitization."""
    assert _sanitize_id("Hello World") == "hello_world"
    assert _sanitize_id("React Hooks!") == "react_hooks"
    assert _sanitize_id("  Spaced  Text  ") == "spaced_text"
    assert _sanitize_id("123-test") == "123-test"
    print("✓ test_sanitize_id passed")


def test_extract_subtopics_from_detected():
    """Test extraction of subtopics from different formats."""
    # Dict format with 'name' key
    concepts1 = [{"name": "Topic A"}, {"name": "Topic B", "confidence": 0.9}]
    assert _extract_subtopics_from_detected(concepts1) == ["Topic A", "Topic B"]
    
    # Dict format with 'title' key
    concepts2 = [{"title": "Concept X"}, {"title": "Concept Y"}]
    assert _extract_subtopics_from_detected(concepts2) == ["Concept X", "Concept Y"]
    
    # String list
    concepts3 = ["Plain String", "Another String"]
    assert _extract_subtopics_from_detected(concepts3) == ["Plain String", "Another String"]
    
    # Empty
    assert _extract_subtopics_from_detected([]) == []
    
    print("✓ test_extract_subtopics_from_detected passed")


def test_build_concept_graph_depth_0():
    """Test graph building with depth 0 (core only)."""
    graph = build_concept_graph(
        topic_id="test-topic",
        topic_title="Test Topic",
        detected_concepts=None,
        max_depth=0,
        use_gemini_fallback=False,
    )
    
    assert len(graph.nodes) == 1
    assert graph.nodes[0].id == "test-topic"
    assert graph.nodes[0].label == "Test Topic"
    assert graph.nodes[0].kind == "core"
    assert graph.nodes[0].depth == 0
    assert len(graph.edges) == 0
    assert graph.root_id == "test-topic"
    assert graph.max_depth == 0
    
    print("✓ test_build_concept_graph_depth_0 passed")


def test_build_concept_graph_with_detected_concepts():
    """Test graph building with pre-detected concepts."""
    detected = [
        {"name": "Subtopic A"},
        {"name": "Subtopic B"},
        {"name": "Subtopic C"},
    ]
    
    graph = build_concept_graph(
        topic_id="main-topic",
        topic_title="Main Topic",
        detected_concepts=detected,
        max_depth=1,
        max_children=5,
        use_gemini_fallback=False,
    )
    
    assert len(graph.nodes) == 4  # 1 core + 3 subtopics
    assert graph.root_id == "main-topic"
    
    # Check core node
    core = next(n for n in graph.nodes if n.kind == "core")
    assert core.id == "main-topic"
    assert core.depth == 0
    
    # Check subtopic nodes
    subtopics = [n for n in graph.nodes if n.kind == "subtopic"]
    assert len(subtopics) == 3
    for st in subtopics:
        assert st.depth == 1
        assert st.parent_id == "main-topic"
    
    # Check edges
    assert len(graph.edges) == 3
    for edge in graph.edges:
        assert edge.source == "main-topic"
        assert edge.relation == "contains"
    
    print("✓ test_build_concept_graph_with_detected_concepts passed")


def test_build_concept_graph_depth_2():
    """Test graph building with depth 2 (requires Gemini or mocking)."""
    # Without Gemini, we need detected concepts for depth 1
    detected = [{"name": "Sub A"}, {"name": "Sub B"}]
    
    graph = build_concept_graph(
        topic_id="deep-topic",
        topic_title="Deep Topic",
        detected_concepts=detected,
        max_depth=2,
        max_children=3,
        use_gemini_fallback=False,  # No Gemini, so depth 2 won't have children
    )
    
    # Should have core + 2 subtopics (no detail nodes without Gemini)
    assert len(graph.nodes) >= 3
    assert graph.max_depth >= 1
    
    print("✓ test_build_concept_graph_depth_2 passed")


def test_graph_to_legacy_format():
    """Test conversion to legacy frontend format."""
    graph = build_concept_graph(
        topic_id="legacy-test",
        topic_title="Legacy Test",
        detected_concepts=[{"name": "Child"}],
        max_depth=1,
        use_gemini_fallback=False,
    )
    
    legacy = graph_to_legacy_format(graph)
    
    assert "nodes" in legacy
    assert "edges" in legacy
    assert "rootId" in legacy
    assert "maxDepth" in legacy
    
    # Check node format
    for node in legacy["nodes"]:
        assert "id" in node
        assert "label" in node
        assert "kind" in node
        assert "depth" in node
        assert "parentId" in node
    
    # Check edge format
    for edge in legacy["edges"]:
        assert "from" in edge
        assert "to" in edge
        assert "relation" in edge
    
    print("✓ test_graph_to_legacy_format passed")


def test_cycle_prevention():
    """Test that duplicate node IDs are handled."""
    # Create concepts with potentially duplicate names
    detected = [
        {"name": "Same Name"},
        {"name": "Same Name"},  # Duplicate
        {"name": "Same Name"},  # Another duplicate
    ]
    
    graph = build_concept_graph(
        topic_id="cycle-test",
        topic_title="Cycle Test",
        detected_concepts=detected,
        max_depth=1,
        use_gemini_fallback=False,
    )
    
    # All node IDs should be unique
    ids = [n.id for n in graph.nodes]
    assert len(ids) == len(set(ids)), "Node IDs should be unique"
    
    print("✓ test_cycle_prevention passed")


def test_max_children_limit():
    """Test that max_children limit is respected."""
    # Create more concepts than max_children
    detected = [{"name": f"Topic {i}"} for i in range(10)]
    
    graph = build_concept_graph(
        topic_id="limit-test",
        topic_title="Limit Test",
        detected_concepts=detected,
        max_depth=1,
        max_children=3,
        use_gemini_fallback=False,
    )
    
    # Should have core + max 3 children
    assert len(graph.nodes) <= 4  # 1 core + 3 max children
    
    print("✓ test_max_children_limit passed")


if __name__ == "__main__":
    print("\n=== Running Concept Graph Builder Tests ===\n")
    
    test_sanitize_id()
    test_extract_subtopics_from_detected()
    test_build_concept_graph_depth_0()
    test_build_concept_graph_with_detected_concepts()
    test_build_concept_graph_depth_2()
    test_graph_to_legacy_format()
    test_cycle_prevention()
    test_max_children_limit()
    
    print("\n=== All tests passed! ===\n")
