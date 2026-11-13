import LandingSections from "@/components/LandingSections";
import SiteStructuredData from "@/components/SiteStructuredData";
import HomeExperience from "@/components/HomeExperience";

export default function ConvertPage() {
  return <><SiteStructuredData /><HomeExperience initialView="converter"><LandingSections /></HomeExperience></>;
}
