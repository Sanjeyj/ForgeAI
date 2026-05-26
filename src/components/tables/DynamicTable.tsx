'use client';

import React, { useState, useMemo } from 'react';
import { EntityDefinition } from '@/lib/schema/schema-validator';
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, Edit2, Trash2, ArrowRight, TableProperties } from 'lucide-react';

interface DynamicTableProps {
  entity: EntityDefinition;
  records: Array<{ id: string; payload: any; createdAt: string | Date }>;
  isLoading?: boolean;
  onEdit: (record: { id: string; payload: any }) => void;
  onDelete: (id: string) => void;
}

export const DynamicTable: React.FC<DynamicTableProps> = ({
  entity,
  records,
  isLoading = false,
  onEdit,
  onDelete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterField, setFilterField] = useState<string>('');
  const [filterValue, setFilterValue] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 1. Get headers/columns from entity schema
  const columns = useMemo(() => {
    return entity.fields.map(f => ({
      name: f.name,
      label: f.placeholder || f.name.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase()),
      type: f.type,
      options: f.options,
    }));
  }, [entity]);

  // 2. Extracted list of dropdown select columns for filter criteria
  const selectColumns = useMemo(() => {
    return columns.filter(c => c.type === 'select');
  }, [columns]);

  // 3. Reset filter value if filter field changes
  const handleFilterFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterField(e.target.value);
    setFilterValue('');
    setCurrentPage(1);
  };

  // 4. Toggle sorting
  const handleSort = (fieldName: string) => {
    if (sortField === fieldName) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(fieldName);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // 5. Process searching, filtering, and sorting
  const processedRecords = useMemo(() => {
    let result = records.map(r => ({
      id: r.id,
      payload: r.payload || {},
      createdAt: r.createdAt,
    }));

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        return Object.values(r.payload).some(val => 
          String(val ?? '').toLowerCase().includes(q)
        );
      });
    }

    // Dropdown column filter
    if (filterField && filterValue) {
      result = result.filter(r => {
        return String(r.payload[filterField] ?? '') === filterValue;
      });
    }

    // Sort order
    if (sortField) {
      result.sort((a, b) => {
        let valA = a.payload[sortField];
        let valB = b.payload[sortField];

        // Format dates or numbers for comparisons
        const fieldType = columns.find(c => c.name === sortField)?.type;
        if (fieldType === 'number') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else {
          valA = String(valA ?? '').toLowerCase();
          valB = String(valB ?? '').toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default to newest first
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [records, searchQuery, filterField, filterValue, sortField, sortDirection, columns]);

  // 6. Pagination slice
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedRecords.slice(start, start + pageSize);
  }, [processedRecords, currentPage, pageSize]);

  const totalPages = Math.ceil(processedRecords.length / pageSize) || 1;

  const renderSortIcon = (fieldName: string) => {
    if (sortField !== fieldName) {
      return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/45 group-hover:text-muted-foreground" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> 
      : <ChevronDown className="h-3.5 w-3.5 text-primary" />;
  };

  return (
    <div className="space-y-4">
      {/* 1. Control Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/40 p-4 border border-border rounded-lg shadow-sm">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search across ${entity.name}...`}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectColumns.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">Filter:</span>
              <select
                value={filterField}
                onChange={handleFilterFieldChange}
                className="bg-background border border-border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="">No Filter</option>
                {selectColumns.map(c => (
                  <option key={c.name} value={c.name}>{c.label}</option>
                ))}
              </select>

              {filterField && (
                <select
                  value={filterValue}
                  onChange={(e) => { setFilterValue(e.target.value); setCurrentPage(1); }}
                  className="bg-background border border-border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="">All values</option>
                  {selectColumns
                    .find(c => c.name === filterField)
                    ?.options?.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                </select>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Size:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-background border border-border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
            >
              <option value={5}>5 rows</option>
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Responsive Table Viewport */}
      <div className="border border-border rounded-lg bg-background overflow-x-auto shadow-sm">
        <table className="w-full border-collapse text-left text-xs min-w-[600px]">
          <thead className="bg-muted/65 text-muted-foreground uppercase text-[10px] font-bold border-b border-border select-none">
            <tr>
              {columns.map(col => (
                <th 
                  key={col.name}
                  onClick={() => handleSort(col.name)}
                  className="px-4 py-3 cursor-pointer group hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-foreground/80">
                    {col.label}
                    {renderSortIcon(col.name)}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 w-28 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-border text-foreground">
            {isLoading ? (
              // 3. Loading Skeletons
              Array.from({ length: 3 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="px-4 py-4">
                      <div className="h-3.5 bg-muted rounded w-3/4"></div>
                    </td>
                  ))}
                  <td className="px-4 py-4">
                    <div className="h-3.5 bg-muted rounded w-1/2 ml-auto"></div>
                  </td>
                </tr>
              ))
            ) : paginatedRecords.length === 0 ? (
              // 4. Empty State
              <tr>
                <td colSpan={columns.length + 1} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <div className="p-3 bg-muted rounded-full text-muted-foreground">
                      <TableProperties className="h-6 w-6" />
                    </div>
                    <h4 className="font-semibold text-sm text-foreground">No records found</h4>
                    <p className="text-xs text-muted-foreground">
                      {records.length === 0 
                        ? `Submit your first record to begin compiling dynamic data for ${entity.name}.`
                        : `No active records match your search query: "${searchQuery}".`}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // 5. Rendered Rows
              paginatedRecords.map((record) => (
                <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                  {columns.map(col => {
                    const value = record.payload[col.name];
                    return (
                      <td key={col.name} className="px-4 py-3.5 font-medium max-w-xs truncate">
                        {col.type === 'checkbox' ? (
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            value === true || value === 'true'
                              ? 'bg-green-500/10 text-green-500 border border-green-500/10'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}>
                            {value === true || value === 'true' ? 'Yes' : 'No'}
                          </span>
                        ) : col.type === 'date' && value ? (
                          new Date(value).toLocaleDateString()
                        ) : (
                          String(value ?? '-')
                        )}
                      </td>
                    );
                  })}
                  
                  {/* Actions Column */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onEdit(record)}
                        title="Edit Row"
                        className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-primary transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this record?')) {
                            onDelete(record.id);
                          }
                        }}
                        title="Delete Row"
                        className="p-1 rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 6. Dynamic Pagination Bar */}
      {processedRecords.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground select-none px-1">
          <div>
            Showing <span className="font-semibold text-foreground">
              {Math.min((currentPage - 1) * pageSize + 1, processedRecords.length)}
            </span> to <span className="font-semibold text-foreground">
              {Math.min(currentPage * pageSize, processedRecords.length)}
            </span> of <span className="font-semibold text-foreground">{processedRecords.length}</span> entries
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 border border-border bg-background rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`h-6 w-6 rounded flex items-center justify-center font-medium transition-colors cursor-pointer ${
                    currentPage === i + 1
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted border border-border/40 text-foreground'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 border border-border bg-background rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
