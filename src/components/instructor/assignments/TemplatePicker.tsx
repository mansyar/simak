import { useState, useEffect } from 'react';
import { listTemplates } from '@/server/templates';
import { useI18n } from '../../../routes/__root';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Clipboard, Search, Check, ChevronRight } from 'lucide-react';

interface Template {
  id: number;
  name: string;
  type: string;
  checkpoints: string[];
}

interface TemplatePickerProps {
  selectedTemplateId: number | null;
  onSelectTemplate: (template: Template) => void;
}

export function TemplatePicker({ selectedTemplateId, onSelectTemplate }: TemplatePickerProps) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        setLoading(true);
        // Fetch all templates (with a high limit to capture all of them for picker)
        const response = await (
          listTemplates as unknown as (args: {
            data: { page: number; limit: number; search: string; type?: string };
          }) => Promise<{ templates: Template[] }>
        )({
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t('instructorAssignments.wizard.stepTemplate')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('instructorAssignments.wizard.selectTemplatePrompt')}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('common.searchByName')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <Card key={n} className="p-5 border-dashed animate-pulse space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
          {error}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="p-8 text-center border rounded-xl border-dashed">
          <Clipboard className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {t('common.noSearchResults', { items: t('adminTemplates.title').toLowerCase() })}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Templates Grid List */}
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {filteredTemplates.map((tpl) => {
              const isSelected = tpl.id === selectedTemplateId;
              return (
                <div
                  key={tpl.id}
                  onClick={() => onSelectTemplate(tpl)}
                  className={`group relative flex items-center justify-between p-4 rounded-xl border bg-card cursor-pointer transition-all duration-200 select-none ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40 hover:bg-accent/40'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {tpl.type}
                      </span>
                    </div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {tpl.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {t('instructorAssignments.milestonesCheckpoints', {
                        count: String(tpl.checkpoints.length),
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pl-4">
                    {isSelected ? (
                      <div className="rounded-full bg-primary p-1 text-primary-foreground shadow-sm animate-scale-in">
                        <Check className="h-4 w-4" />
                      </div>
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Checkpoints Preview for the selected template */}
          <Card className="p-5 border-primary/20 bg-gradient-to-br from-card to-accent/10 flex flex-col justify-between">
            {selectedTemplate ? (
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="font-bold text-foreground text-sm tracking-wide uppercase text-muted-foreground">
                    {t('instructorAssignments.wizard.checkpointsPreview')}
                  </h3>
                  <p className="text-base font-bold text-primary mt-1">{selectedTemplate.name}</p>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-primary/20">
                  {selectedTemplate.checkpoints.map((cp, idx) => (
                    <div key={idx} className="relative flex items-start gap-3">
                      <div
                        className={`absolute -left-6 mt-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                          idx === 0
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-background border-muted-foreground/30 text-muted-foreground'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <p
                          className={`text-sm font-semibold ${idx === 0 ? 'text-primary' : 'text-foreground'}`}
                        >
                          {cp}
                        </p>
                        {idx === 0 && (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            {t('instructorAssignments.initiallyUnlocked')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground h-full">
                <Clipboard className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">
                  {t('instructorAssignments.selectTemplateHint')}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
