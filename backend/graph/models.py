"""
Models for concept dependency graph.
"""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


NodeKind = Literal["core", "subtopic", "detail", "prereq", "next"]
EdgeRelation = Literal["contains", "depends_on", "leads_to"]


class GraphNode(BaseModel):
    """A node in the concept graph."""
    id: str = Field(..., description="Unique node identifier")
    label: str = Field(..., description="Display label for the node")
    kind: NodeKind = Field(..., description="Node type: core, subtopic, detail, prereq, next")
    depth: int = Field(0, description="Depth level from root (0 = core topic)")
    parent_id: str | None = Field(None, description="Parent node ID if this is a subtopic")


class GraphEdge(BaseModel):
    """An edge connecting two nodes."""
    source: str = Field(..., alias="from", description="Source node ID")
    target: str = Field(..., alias="to", description="Target node ID")
    relation: EdgeRelation = Field("contains", description="Relationship type")
    
    class Config:
        populate_by_name = True


class ConceptGraph(BaseModel):
    """Complete concept graph structure."""
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    root_id: str | None = Field(None, description="ID of the root/core node")
    max_depth: int = Field(0, description="Maximum depth reached in the graph")


class SubtopicExpansionResult(BaseModel):
    """Result from Gemini subtopic expansion."""
    subtopics: list[str] = Field(default_factory=list)
    cached: bool = Field(False)
