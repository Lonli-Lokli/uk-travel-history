'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, CardContent } from '@uth/ui';
import { FileText, Plus, Upload, ArrowRight, CheckCircle, Plane, Coffee } from 'lucide-react';

export const LandingPage = () => {
  const router = useRouter();

  const handleImportClick = () => {
    router.push('/travel');
  };

  const handleAddManually = () => {
    router.push('/travel');
  };

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

            {/* Buy Me a Coffee Button */}
            <a
              href="https://www.buymeacoffee.com/LonliLokliV"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:block"
            >
              <Button
                variant="outline"
                size="sm"
                className="bg-[#FFDD00] hover:bg-[#FFED4E] border-[#FFDD00] hover:border-[#FFED4E] text-slate-900"
              >
                <Coffee className="h-4 w-4 mr-1.5" />
                Buy Me a Coffee
              </Button>
            </a>

            <a
              href="https://www.buymeacoffee.com/LonliLokliV"
              target="_blank"
              rel="noopener noreferrer"
              className="sm:hidden"
            >
              <Button
                variant="outline"
                size="icon"
                className="bg-[#FFDD00] hover:bg-[#FFED4E] border-[#FFDD00] hover:border-[#FFED4E] text-slate-900"
              >
                <Coffee className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <Card className="bg-white">
          <CardContent className="p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                Welcome to UK Travel Parser
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Track your UK travel history and calculate continuous residence for settlement applications
              </p>
            </div>

            {/* Quick Start Options */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <Card className="border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors bg-primary/5 cursor-pointer" onClick={handleImportClick}>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Import from PDF</h3>
                      <p className="text-xs text-slate-600 mb-4">
                        Upload your Home Office SAR travel history PDF
                      </p>
                    </div>
                    <Button className="w-full">
                      <Upload className="h-4 w-4 mr-2" />
                      Import PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors cursor-pointer" onClick={handleAddManually}>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Add Manually</h3>
                      <p className="text-xs text-slate-600 mb-4">
                        Enter your travel dates manually
                      </p>
                    </div>
                    <Button variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Travel Dates
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* How to Get Your PDF */}
            <div className="bg-slate-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                How to Get Your Travel History PDF
              </h3>
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <span className="font-medium">Request your travel history document</span>
                    <p className="text-xs text-slate-600 mt-1">
                      Use the official UK Visas and Immigration Subject Access Request portal to request your travel document
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <span className="font-medium">Wait for processing</span>
                    <p className="text-xs text-slate-600 mt-1">
                      The Home Office typically responds within 40 days with your travel history PDF
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <span className="font-medium">Upload your PDF here</span>
                    <p className="text-xs text-slate-600 mt-1">
                      Once received, import it using the "Import PDF" button above
                    </p>
                  </div>
                </li>
              </ol>
              <a
                href="https://visas-immigration.service.gov.uk/product/saru"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-4 font-medium"
              >
                Request your travel history document
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>

            {/* What This Tool Does */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-900 mb-4">What This Tool Does</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Calculate days outside the UK</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Track continuous residence period</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Verify 180-day absence limit</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Export formatted Excel reports</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Track vignette & visa dates</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Follows Home Office guidance</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

LandingPage.displayName = 'LandingPage';
