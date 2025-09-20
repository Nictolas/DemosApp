import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Smartphone, CheckCircle } from 'lucide-react';

interface CIEButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function CIEButton({ 
  onClick, 
  disabled = false, 
  className = '',
  variant = 'default',
  size = 'lg'
}: CIEButtonProps) {
  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-blue-600" />
        </div>
        <CardTitle className="text-xl font-semibold text-gray-900">
          Accedi con CIE
        </CardTitle>
        <CardDescription className="text-gray-600">
          Carta d'Identità Elettronica
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Button
          onClick={onClick}
          disabled={disabled}
          variant={variant}
          size={size}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <Shield className="w-5 h-5" />
          <span>Accedi con CIE</span>
        </Button>
        
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Autenticazione sicura e ufficiale</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Completamente gratuito</span>
          </div>
          <div className="flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-blue-500" />
            <span>Richiede app CieID</span>
          </div>
        </div>
        
        <div className="pt-2 border-t">
          <Badge variant="outline" className="text-xs">
            Sostituisce il Codice Fiscale
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default CIEButton;
