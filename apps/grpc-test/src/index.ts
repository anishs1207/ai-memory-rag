import path from 'path';
import { fileURLToPath } from 'url';
import * as grpc from '@grpc/grpc-js';
import type { GrpcObject, ServiceClientConstructor } from "@grpc/grpc-js"
import * as protoLoader from '@grpc/proto-loader';
import type { ProtoGrpcType } from './proto/a.js';
import type { AddressBookServiceHandlers } from './proto/AddressBookService.js';
import { status } from '@grpc/grpc-js';
import { NUMBER } from "@inqora/common";

console.log("test", NUMBER);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageDefinition = protoLoader.loadSync(path.join(__dirname, '../a.proto'));

const personProto = (grpc.loadPackageDefinition(packageDefinition) as unknown) as ProtoGrpcType;

const PERSONS = [
    {
        name: "anish",
        age: 45
    },
    {
      name: "suresh",
      age: 45
    },
];

const handler: AddressBookServiceHandlers =  {
  AddPerson: (call, callback) => {
    let person = {
      name: call.request.name || "",
      age: call.request.age ?? 0
    }
    PERSONS.push(person);
    callback(null, person)
  },
  GetPersonByName: (call, callback) => {
    let person = PERSONS.find(x => x.name === call.request.name);
    if (person) {
      callback(null, person)
    } else {
      callback({
        code: status.NOT_FOUND,
        details: "not found"
      }, null);
    }
  }
}


const server = new grpc.Server();

server.addService((personProto.AddressBookService).service, handler);
server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    server.start();
});