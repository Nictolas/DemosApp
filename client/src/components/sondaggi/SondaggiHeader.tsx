import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart as BarChartIcon } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href: string | null;
  type: 'regione' | 'provincia' | 'comune';
}

interface SondaggiHeaderProps {
  filterPath?: string;
  pageTitle: string;
  breadcrumbItems: BreadcrumbItem[];
  filter?: {
    type: 'regione' | 'provincia' | 'comune';
    value?: string;
    regione?: string;
    provincia?: string;
    comune?: string;
  };
}

export function SondaggiHeader({ filterPath, pageTitle, breadcrumbItems, filter }: SondaggiHeaderProps) {
  if (!filterPath) return null;

  return (
    <div className="mb-8">
      <Link href="/sondaggi">
        <Button variant="ghost" className="mb-4 flex items-center text-gray-600 hover:text-gray-800 hover:bg-white/50">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna ai Sondaggi
        </Button>
      </Link>
      
      {/* Breadcrumb */}
      {breadcrumbItems.length > 0 && (
        <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
          <Link href="/sondaggi">
            <span className="text-blue-600 hover:text-blue-800">Sondaggi</span>
          </Link>
          {breadcrumbItems.map((item, index) => (
            <React.Fragment key={index}>
              <span>/</span>
              {item.href ? (
                <Link href={item.href}>
                  <span className="text-blue-600 hover:text-blue-800">{item.label}</span>
                </Link>
              ) : (
                <span className="text-gray-600">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      
      {/* Titolo principale */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center">
          <BarChartIcon className="mr-3 h-10 w-10 text-blue-600" />
          {pageTitle}
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Statistiche aggregate delle opinioni degli utenti per analizzare le tendenze della comunità
          {filter && (
            <span className="block text-sm text-blue-600 mt-1">
              Filtrato per: {filter.type === 'regione' ? filter.value : 
                            filter.type === 'provincia' ? `${filter.provincia} (${filter.regione})` :
                            `${filter.comune} (${filter.provincia}, ${filter.regione})`}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
