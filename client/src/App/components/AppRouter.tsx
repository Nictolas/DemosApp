import { Switch } from "wouter";
import { MainRoutes } from "../routes/MainRoutes";
import { OpinionRoutes } from "../routes/OpinionRoutes";
import { ManagementRoutes } from "../routes/ManagementRoutes";
import { FeatureRoutes } from "../routes/FeatureRoutes";
import { VotingRoutes } from "../routes/VotingRoutes";
import { SurveyRoutes } from "../routes/SurveyRoutes";
import { AuthRoutes } from "../routes/AuthRoutes";

export const AppRouter = () => {
  return (
    <Switch>
      <MainRoutes />
      <OpinionRoutes />
      <ManagementRoutes />
      <FeatureRoutes />
      <VotingRoutes />
      <SurveyRoutes />
      <AuthRoutes />
    </Switch>
  );
};
