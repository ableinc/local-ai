import { Button } from "./ui/button";
import { Download } from "lucide-react";

interface AppModelExportBtnProps {
  exportChat: () => void;
}
export function AppModelExportBtn({ exportChat }: AppModelExportBtnProps) {
  return (
    <Button
      onClick={exportChat}
      variant="outline"
      size="sm"
      className="ml-2"
    >
      <Download className="h-4 w-4 mr-2" />
      Export
    </Button>
  );
}
