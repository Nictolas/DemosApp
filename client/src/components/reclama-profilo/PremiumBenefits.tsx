import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PremiumBenefitsProps } from "./types";

export function PremiumBenefits({ benefits }: PremiumBenefitsProps) {
  return (
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
          {benefits.map((benefit, index) => (
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
  );
}
