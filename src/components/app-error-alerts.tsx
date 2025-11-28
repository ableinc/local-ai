import { AlertCircle, Calendar, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { ErrorLog } from '@/services/api';

interface AppErrorAlertsProps {
  errorLogs: ErrorLog[];
  isOpen: boolean;
  onClose: () => void;
}

export function AppErrorAlerts({ errorLogs, isOpen, onClose }: AppErrorAlertsProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Application Error Logs
          </DialogTitle>
          <DialogDescription>
            {errorLogs.length} error{errorLogs.length !== 1 ? 's' : ''} logged
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {errorLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No error logs found
            </div>
          ) : (
            errorLogs.map((log) => (
              <div
                key={log.id.toString()}
                className="border rounded-lg p-4 space-y-3 bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm break-words">
                        {log.error_message}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(log.created_at)}
                        </span>
                        {!log.has_embedding_model && (
                          <span className="text-yellow-600 dark:text-yellow-500">
                            No embedding model
                          </span>
                        )}
                        {!log.has_summary_model && (
                          <span className="text-yellow-600 dark:text-yellow-500">
                            No summary model
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {log.stack_trace && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors select-none">
                      View stack trace
                    </summary>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
                      <code>{log.stack_trace}</code>
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
