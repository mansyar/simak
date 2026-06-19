import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { listTemplates } from '@/server/templates';
import { useI18n } from '../../../routes/__root';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Clipboard, Search, Check, ChevronRight } from 'lucide-react';
export function TemplatePicker({ selectedTemplateId, onSelectTemplate }) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  useEffect(() => {
    async function fetchTemplates() {
      try {
        setLoading(true);
        // Fetch all templates (with a high limit to capture all of them for picker)
        const response = await listTemplates({
          data: { page: 1, limit: 100, search: '' },
        });
        if (response && response.templates) {
          setTemplates(response.templates);
        }
      } catch (err) {
        console.error('Failed to load templates', err);
        setError('Could not load assignment templates.');
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);
  const filteredTemplates = templates.filter(
    (tpl) =>
      tpl.name.toLowerCase().includes(search.toLowerCase()) ||
      tpl.type.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex flex-col gap-2',
        children: [
          _jsx('h2', {
            className: 'text-xl font-bold tracking-tight text-foreground',
            children: t('instructorAssignments.wizard.stepTemplate'),
          }),
          _jsx('p', {
            className: 'text-sm text-muted-foreground',
            children: t('instructorAssignments.wizard.selectTemplatePrompt'),
          }),
        ],
      }),
      _jsxs('div', {
        className: 'relative',
        children: [
          _jsx(Search, {
            className: 'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground',
          }),
          _jsx(Input, {
            placeholder: t('common.searchByName'),
            value: search,
            onChange: (e) => setSearch(e.target.value),
            className: 'pl-9 h-11',
          }),
        ],
      }),
      loading
        ? _jsx('div', {
            className: 'grid gap-4 sm:grid-cols-2',
            children: [1, 2, 3, 4].map((n) =>
              _jsxs(
                Card,
                {
                  className: 'p-5 border-dashed animate-pulse space-y-3',
                  children: [
                    _jsx(Skeleton, { className: 'h-4 w-2/3' }),
                    _jsx(Skeleton, { className: 'h-3 w-1/3' }),
                    _jsxs('div', {
                      className: 'flex gap-2 pt-2',
                      children: [
                        _jsx(Skeleton, { className: 'h-6 w-16 rounded-full' }),
                        _jsx(Skeleton, { className: 'h-6 w-16 rounded-full' }),
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
          : filteredTemplates.length === 0
            ? _jsxs('div', {
                className: 'p-8 text-center border rounded-xl border-dashed',
                children: [
                  _jsx(Clipboard, {
                    className: 'h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-3',
                  }),
                  _jsx('p', {
                    className: 'text-sm text-muted-foreground',
                    children: t('common.noSearchResults', {
                      items: t('adminTemplates.title').toLowerCase(),
                    }),
                  }),
                ],
              })
            : _jsxs('div', {
                className: 'grid gap-4 md:grid-cols-2',
                children: [
                  _jsx('div', {
                    className: 'space-y-3 max-h-[380px] overflow-y-auto pr-1',
                    children: filteredTemplates.map((tpl) => {
                      const isSelected = tpl.id === selectedTemplateId;
                      return _jsxs(
                        'div',
                        {
                          onClick: () => onSelectTemplate(tpl),
                          className: `group relative flex items-center justify-between p-4 rounded-xl border bg-card cursor-pointer transition-all duration-200 select-none ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                              : 'border-border hover:border-primary/40 hover:bg-accent/40'
                          }`,
                          children: [
                            _jsxs('div', {
                              className: 'space-y-1 flex-1',
                              children: [
                                _jsx('div', {
                                  className: 'flex items-center gap-2',
                                  children: _jsx('span', {
                                    className:
                                      'text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full',
                                    children: tpl.type,
                                  }),
                                }),
                                _jsx('h4', {
                                  className:
                                    'font-semibold text-foreground group-hover:text-primary transition-colors',
                                  children: tpl.name,
                                }),
                                _jsx('p', {
                                  className: 'text-xs text-muted-foreground',
                                  children: t('instructorAssignments.milestonesCheckpoints', {
                                    count: String(tpl.checkpoints.length),
                                  }),
                                }),
                              ],
                            }),
                            _jsx('div', {
                              className: 'flex items-center gap-2 pl-4',
                              children: isSelected
                                ? _jsx('div', {
                                    className:
                                      'rounded-full bg-primary p-1 text-primary-foreground shadow-sm animate-scale-in',
                                    children: _jsx(Check, { className: 'h-4 w-4' }),
                                  })
                                : _jsx(ChevronRight, {
                                    className:
                                      'h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity',
                                  }),
                            }),
                          ],
                        },
                        tpl.id,
                      );
                    }),
                  }),
                  _jsx(Card, {
                    className:
                      'p-5 border-primary/20 bg-gradient-to-br from-card to-accent/10 flex flex-col justify-between',
                    children: selectedTemplate
                      ? _jsxs('div', {
                          className: 'space-y-4',
                          children: [
                            _jsxs('div', {
                              className: 'border-b pb-2',
                              children: [
                                _jsx('h3', {
                                  className:
                                    'font-bold text-foreground text-sm tracking-wide uppercase text-muted-foreground',
                                  children: t('instructorAssignments.wizard.checkpointsPreview'),
                                }),
                                _jsx('p', {
                                  className: 'text-base font-bold text-primary mt-1',
                                  children: selectedTemplate.name,
                                }),
                              ],
                            }),
                            _jsx('div', {
                              className:
                                'relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-primary/20',
                              children: selectedTemplate.checkpoints.map((cp, idx) =>
                                _jsxs(
                                  'div',
                                  {
                                    className: 'relative flex items-start gap-3',
                                    children: [
                                      _jsx('div', {
                                        className: `absolute -left-6 mt-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                                          idx === 0
                                            ? 'bg-primary border-primary text-primary-foreground'
                                            : 'bg-background border-muted-foreground/30 text-muted-foreground'
                                        }`,
                                        children: idx + 1,
                                      }),
                                      _jsxs('div', {
                                        children: [
                                          _jsx('p', {
                                            className: `text-sm font-semibold ${idx === 0 ? 'text-primary' : 'text-foreground'}`,
                                            children: cp,
                                          }),
                                          idx === 0 &&
                                            _jsx('span', {
                                              className:
                                                'text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                                              children: t(
                                                'instructorAssignments.initiallyUnlocked',
                                              ),
                                            }),
                                        ],
                                      }),
                                    ],
                                  },
                                  idx,
                                ),
                              ),
                            }),
                          ],
                        })
                      : _jsxs('div', {
                          className:
                            'flex flex-col items-center justify-center py-16 text-center text-muted-foreground h-full',
                          children: [
                            _jsx(Clipboard, {
                              className: 'h-10 w-10 text-muted-foreground/40 mb-3',
                            }),
                            _jsx('p', {
                              className: 'text-sm font-medium',
                              children: t('instructorAssignments.selectTemplateHint'),
                            }),
                          ],
                        }),
                  }),
                ],
              }),
    ],
  });
}
