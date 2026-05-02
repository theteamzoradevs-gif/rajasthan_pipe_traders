"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AdminCategory } from "../types";

interface Props {
  category: AdminCategory;
  index: number;
  onEdit: (c: AdminCategory) => void;
  onDelete: (id: string) => void;
  page: number;
  pageSize: number;
  comboCount?: number;
  onOpenCombo?: (c: AdminCategory) => void;
  onRearrange?: (c: AdminCategory) => void;
}

export function SortableCategoryRow({
  category,
  index,
  onEdit,
  onDelete,
  page,
  pageSize,
  comboCount = 0,
  onOpenCombo,
  onRearrange,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? "var(--admin-bg-hover, #f8fafc)" : undefined,
    zIndex: isDragging ? 1 : undefined,
    position: "relative" as const,
  };

  return (
    <tr ref={setNodeRef} style={style} id={`admin-row-${category._id}`}>
      <td {...attributes} {...listeners} style={{ cursor: "grab", width: "40px" }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="muted"
        >
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </td>
      <td>{page * pageSize + index + 1}</td>
      <td>
        {category.image ? (
          <img src={category.image} alt="" className="admin-thumb" />
        ) : (
          "—"
        )}
      </td>
      <td>{category.name}</td>
      <td>{category.sortOrder ?? 0}</td>
      <td>{category.isActive ? "Yes" : "No"}</td>
      <td style={{ whiteSpace: "nowrap" }}>
        {comboCount > 0 && onOpenCombo && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            style={{ marginRight: 6 }}
            onClick={() => onOpenCombo(category)}
          >
            Combo products
          </button>
        )}
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          style={{ marginRight: 6 }}
          onClick={() => onRearrange && onRearrange(category)}
        >
          Rearrange
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          style={{ marginRight: 6 }}
          onClick={() => onEdit(category)}
        >
          Edit
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-danger"
          onClick={() => onDelete(category._id)}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
