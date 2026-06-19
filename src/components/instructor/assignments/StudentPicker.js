import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { listUsers } from '@/server/users';
import { useI18n } from '../../../routes/__root';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, Check, CheckSquare, Square } from 'lucide-react';
export function StudentPicker({
  selectedStudentIds,
  onToggleStudent,
  onSelectAll,
  onDeselectAll: _onDeselectAll,
  errors,
}) {
  const { t } = useI18n();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  useEffect(() => {
    async function fetchStudents() {
      try {
        setLoading(true);
        // Request page 1 with high limit to capture all student users
        const response = await listUsers({
          data: { page: 1, limit: 200, search: '', role: 'student' },
        });
        if (response && response.users) {
          setStudents(response.users);
        }
      } catch (err) {
        console.error('Failed to load students', err);
        setError('Could not load student list.');
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, []);
  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()),
  );
  const allFilteredIds = filteredStudents.map((s) => s.id);
  const areAllFilteredSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedStudentIds.includes(id));
  const handleSelectAllToggle = () => {
    if (areAllFilteredSelected) {
      // Deselect only the currently filtered students
      const newSelected = selectedStudentIds.filter((id) => !allFilteredIds.includes(id));
      onSelectAll(newSelected); // actually this updates selection state
    } else {
      // Select all filtered students (merge with pre-selected)
      const merged = Array.from(new Set([...selectedStudentIds, ...allFilteredIds]));
      onSelectAll(merged);
    }
  };
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
        children: [
          _jsxs('div', {
            className: 'flex flex-col gap-1.5',
            children: [
              _jsx('h2', {
                className: 'text-xl font-bold tracking-tight text-foreground',
                children: t('instructorAssignments.wizard.stepStudents'),
              }),
              _jsx('p', {
                className: 'text-sm text-muted-foreground',
                children: t('instructorAssignments.wizard.selectStudentsPrompt'),
              }),
            ],
          }),
          _jsx('div', {
            className: 'flex items-center gap-2 self-start sm:self-center',
            children: _jsxs('div', {
              className: `text-xs font-bold tracking-wide uppercase px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                selectedStudentIds.length > 0
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-muted text-muted-foreground border border-transparent'
              }`,
              children: [
                _jsx(Users, { className: 'h-3.5 w-3.5' }),
                selectedStudentIds.length > 0
                  ? t('instructorAssignments.wizard.selectedStudents', {
                      count: String(selectedStudentIds.length),
                    })
                  : t('instructorAssignments.wizard.noStudentsSelected'),
              ],
            }),
          }),
        ],
      }),
      _jsxs('div', {
        className: 'flex flex-col sm:flex-row gap-3',
        children: [
          _jsxs('div', {
            className: 'relative flex-1',
            children: [
              _jsx(Search, {
                className: 'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground',
              }),
              _jsx(Input, {
                placeholder: t('instructorAssignments.wizard.searchStudents'),
                value: search,
                onChange: (e) => setSearch(e.target.value),
                className: 'pl-9 h-11',
              }),
            ],
          }),
          !loading &&
            filteredStudents.length > 0 &&
            _jsx('button', {
              type: 'button',
              onClick: handleSelectAllToggle,
              className:
                'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-semibold shadow-sm transition-all hover:bg-accent hover:text-accent-foreground select-none',
              children: areAllFilteredSelected
                ? _jsxs(_Fragment, {
                    children: [
                      _jsx(CheckSquare, { className: 'h-4 w-4 text-primary' }),
                      t('instructorAssignments.deselectAll'),
                    ],
                  })
                : _jsxs(_Fragment, {
                    children: [
                      _jsx(Square, { className: 'h-4 w-4' }),
                      t('instructorAssignments.selectAll'),
                    ],
                  }),
            }),
        ],
      }),
      errors.studentIds &&
        _jsx('p', {
          className: 'text-xs font-bold text-destructive animate-slide-down',
          children: errors.studentIds,
        }),
      loading
        ? _jsx('div', {
            className: 'grid gap-3 sm:grid-cols-2 md:grid-cols-3',
            children: [1, 2, 3, 4, 5, 6].map((n) =>
              _jsxs(
                Card,
                {
                  className: 'p-4 border-dashed animate-pulse flex items-center gap-3',
                  children: [
                    _jsx(Skeleton, { className: 'h-9 w-9 rounded-full' }),
                    _jsxs('div', {
                      className: 'space-y-2 flex-1',
                      children: [
                        _jsx(Skeleton, { className: 'h-4 w-3/4' }),
                        _jsx(Skeleton, { className: 'h-3 w-1/2' }),
                      ],
                    }),
                  ],
                },
                n,
              ),
            ),
          })
        : error
          ? _jsx('div', {
              className: 'p-4 rounded-lg bg-destructive/10 text-destructive text-sm text-center',
              children: error,
            })
          : filteredStudents.length === 0
            ? _jsxs('div', {
                className: 'p-8 text-center border rounded-xl border-dashed',
                children: [
                  _jsx(Users, {
                    className: 'h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-3',
                  }),
                  _jsx('p', {
                    className: 'text-sm text-muted-foreground',
                    children: t('common.noSearchResults', {
                      items: t('common.search').toLowerCase(),
                    }),
                  }),
                ],
              })
            : _jsx('div', {
                className:
                  'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[380px] overflow-y-auto pr-1',
                children: filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  const initials = student.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  return _jsxs(
                    'div',
                    {
                      onClick: () => onToggleStudent(student.id),
                      className: `group flex items-center justify-between p-4 rounded-xl border bg-card cursor-pointer transition-all duration-200 select-none ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/40 hover:bg-accent/40'
                      }`,
                      children: [
                        _jsxs('div', {
                          className: 'flex items-center gap-3 min-w-0 flex-1',
                          children: [
                            _jsx('div', {
                              className: `h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                              }`,
                              children: initials || 'S',
                            }),
                            _jsxs('div', {
                              className: 'min-w-0 flex-1',
                              children: [
                                _jsx('p', {
                                  className:
                                    'text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors',
                                  children: student.name,
                                }),
                                _jsx('p', {
                                  className: 'text-xs text-muted-foreground truncate',
                                  children: student.email,
                                }),
                              ],
                            }),
                          ],
                        }),
                        _jsx('div', {
                          className: 'flex items-center gap-2 pl-3',
                          children: isSelected
                            ? _jsx('div', {
                                className:
                                  'rounded-full bg-primary p-1 text-primary-foreground shadow-sm animate-scale-in',
                                children: _jsx(Check, { className: 'h-3 w-3' }),
                              })
                            : _jsx('div', {
                                className:
                                  'h-4.5 w-4.5 rounded-full border border-muted-foreground/30 group-hover:border-primary/50 transition-colors',
                              }),
                        }),
                      ],
                    },
                    student.id,
                  );
                }),
              }),
    ],
  });
}
