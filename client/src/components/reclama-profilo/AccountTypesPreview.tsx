import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AccountTypesPreviewProps } from "./types";

export function AccountTypesPreview({ accountTypes }: AccountTypesPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Scegli il Tuo Account DEMOS
        </CardTitle>
        <CardDescription>
          Diversi piani per diverse esigenze politiche
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {accountTypes.slice(0, 2).map((account, index) => (
            <div key={index} className={`p-3 border rounded-lg ${account.popular ? 'border-primary bg-primary/5' : ''}`}>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">{account.name}</h4>
                <span className="text-sm font-bold text-primary">
                  {account.price} {account.period !== "per sempre" && `/${account.period}`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{account.description}</p>
            </div>
          ))}
          <Button variant="outline" className="w-full">
            Visualizza tutti i piani
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
