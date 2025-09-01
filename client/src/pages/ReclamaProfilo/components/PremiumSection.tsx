import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { premiumBenefits, accountTypes } from "../constants";

export const PremiumSection = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">
            Vantaggi di DEMOS Premium
          </CardTitle>
          <CardDescription>
            Con soli 50 € all'anno, DEMOS Premium ti offre:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {premiumBenefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                {benefit.icon}
                <div>
                  <h4 className="font-medium">{benefit.title}</h4>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account Types Preview */}
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
    </div>
  );
};
