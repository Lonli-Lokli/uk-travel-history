'use client';

import { useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import {
  travelStore,
  useToast,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  TravelTable,
} from '@uth/ui';
import {} from '@uth/ui';
import {
  Upload,
  Download,
  Trash2,
  FileSpreadsheet,
  Plane,
  CalendarDays,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const HomePage = observer(() => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        await travelStore.importFromPdf(file);
        toast({
          title: 'Import successful',
          description: `Imported ${travelStore.summary.totalTrips} trips from PDF`,
          variant: 'success' as any,
        });
      } catch (err) {
        toast({
          title: 'Import failed',
          description:
            err instanceof Error ? err.message : 'Failed to parse PDF',
          variant: 'destructive',
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [toast]
  );

  const handleExport = useCallback(async () => {
    if (travelStore.trips.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'Add some trips first',
        variant: 'destructive',
      });
      return;
    }

    try {
      const blob = await travelStore.exportToExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'UK_Travel_History.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export successful',
        description: 'Excel file downloaded',
        variant: 'success' as any,
      });
    } catch (err) {
      toast({
        title: 'Export failed',
        description: 'Failed to generate Excel file',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleClearAll = useCallback(() => {
    travelStore.clearAll();
    toast({
      title: 'Cleared',
      description: 'All trips have been removed',
    });
  }, [toast]);

  const summary = travelStore.summary;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-slate-900 text-sm sm:text-base">
                  UK Travel Parser
                </h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                  Calculate days outside UK
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex"
                onClick={() => fileInputRef.current?.click()}
                disabled={travelStore.isLoading}
              >
                {travelStore.isLoading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1.5" />
                )}
                Import PDF
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="sm:hidden"
                onClick={() => fileInputRef.current?.click()}
                disabled={travelStore.isLoading}
              >
                {travelStore.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>

              <Button
                size="sm"
                className="hidden sm:flex"
                onClick={handleExport}
                disabled={travelStore.trips.length === 0}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Export Excel
              </Button>

              <Button
                size="icon"
                className="sm:hidden"
                onClick={handleExport}
                disabled={travelStore.trips.length === 0}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card className="bg-white">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-slate-900">
                    {summary.totalTrips}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Total Trips
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-slate-900">
                    {summary.completeTrips}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Complete
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-slate-900">
                    {summary.incompleteTrips}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Incomplete
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold">
                    {summary.totalFullDays}
                  </p>
                  <p className="text-[10px] sm:text-xs opacity-80">
                    Days Outside UK
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Card */}
        <Card className="bg-white">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                Travel History
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Click on any cell to edit. Full days exclude travel days.
              </p>
            </div>

            {travelStore.trips.length > 0 && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Clear All</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Clear all trips?</DialogTitle>
                    <DialogDescription>
                      This will remove all {travelStore.trips.length} trips.
                      This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" className="flex-1 sm:flex-none">
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 sm:flex-none"
                      onClick={handleClearAll}
                    >
                      Clear All
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>

          <CardContent>
            <TravelTable />
          </CardContent>
        </Card>

        {/* Info Section */}
        <div className="mt-4 sm:mt-6 text-center text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Calculation:</strong> Full days = (Return − Departure) − 1,
            excluding both travel days.
          </p>
          <p>
            Works with UK Home Office Subject Access Request (SAR) documents.
          </p>
        </div>
      </main>
    </div>
  );
});

export default HomePage;
