import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
    Collapsible,
    CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import type { McpServer } from "@/services/api";

interface AppMCPServersProps {
  open: boolean;
  setIsOpen: (open: boolean) => void;
  mcpServers: McpServer[];
  doCreateNew: boolean;
  createNewFunc: (body: McpServer) => void;
  deleteFunc: (id: number) => void;
}

interface McpServersTableProps {
  mcpServers: McpServer[];
  deleteFunc: (id: number) => void;
}

function McpServersTable({ mcpServers, deleteFunc }: McpServersTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<McpServer | null>(null);

  const handleDeleteClick = (server: McpServer) => {
    setServerToDelete(server);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (serverToDelete && deleteFunc) {
      deleteFunc(serverToDelete.id);
    }
    setDeleteDialogOpen(false);
    setServerToDelete(null);
  };

  return (
    <>
      <Table>
        <TableCaption>A list of your MCP servers</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Name</TableHead>
            <TableHead>URL</TableHead>
            <TableHead className="text-right">Delete</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mcpServers.map((server) => (
            <TableRow key={server.id}>
              <TableCell className="font-medium">{server.name}</TableCell>
              <TableCell>{server.url}</TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleDeleteClick(server)}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the MCP server "{serverToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface McpServerCreationFormProps {
  createNewFunc: (body: McpServer) => void;
}

function McpServerCreationForm({ createNewFunc }: McpServerCreationFormProps) {
  const form = useForm<McpServer>({
    mode: "onChange",
    defaultValues: {
      name: "",
      url: "",
      api_key: "",
    },
  });

  const onSubmit = (data: McpServer) => {
    if (createNewFunc) {
      createNewFunc(data);
      form.reset();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          rules={{ required: "Name is required" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Server Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="url"
          rules={{ 
            required: "URL is required",
            pattern: {
              value: /^https?:\/\/.+/,
              message: "Please enter a valid URL"
            }
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="api_key"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key <span className="text-muted-foreground text-xs">(Optional)</span></FormLabel>
              <FormControl>
                <Input type="text" placeholder="API Key (optional)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit">Add MCP Server</Button>
      </form>
    </Form>
  )
}

export function AppMCPServers({ open, setIsOpen, mcpServers, createNewFunc, doCreateNew, deleteFunc }: AppMCPServersProps) {
  return (
    <div className="w-full">
      <Collapsible
        open={open}
        onOpenChange={setIsOpen}
        className="w-full"
      >
        <CollapsibleContent className="w-full">
          { doCreateNew ? 
          (
            <McpServerCreationForm createNewFunc={createNewFunc} />
          )
        :
          (
            <McpServersTable mcpServers={mcpServers || []} deleteFunc={deleteFunc} />
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
