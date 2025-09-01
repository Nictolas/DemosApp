import { Switch, useLocation } from "wouter";
import { MainRoutes } from "../routes/MainRoutes";
import { OpinionRoutes } from "../routes/OpinionRoutes";
import { ManagementRoutes } from "../routes/ManagementRoutes";
import { FeatureRoutes } from "../routes/FeatureRoutes";
import { VotingRoutes } from "../routes/VotingRoutes";
import { SurveyRoutes } from "../routes/SurveyRoutes";
import { AuthRoutes } from "../routes/AuthRoutes";

export const AppRouter = () => {
  const [location] = useLocation();
  
  return (
    <Switch>
      <MainRoutes location={location} />
      <OpinionRoutes location={location} />
      <ManagementRoutes location={location} />
      <FeatureRoutes location={location} />
      <VotingRoutes location={location} />
      <SurveyRoutes location={location} />
      <AuthRoutes location={location} />
    </Switch>
  );
};
