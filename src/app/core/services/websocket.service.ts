import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as Stomp from '@stomp/stompjs';
import { BehaviorSubject, filter } from 'rxjs';
import * as SockJS from 'sockjs-client';
import { Mensagem } from '../models/mensagem.models';
import { environment } from 'src/environments/environment';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {

  private _mensagemRespostaSubject: BehaviorSubject<Mensagem> = new BehaviorSubject({} as Mensagem);
  private _socket?: WebSocket;
  private _client?: Stomp.CompatClient;
  private _activeUrl?: string;

  constructor(private http: HttpClient, private router: Router) {

    router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    )
      .subscribe({
        next: (event) => {
          this._activeUrl = (event as NavigationEnd).url;
        }
      });
  }

  connect(idChat: number) {
    this._socket = new SockJS(`${environment.target}/live-chat`);
    this._client = Stomp.Stomp.over(this._socket);

    this._client.activate();

    this._client.connect({}, (frame: any) => {

      if (this._client?.connected) {
        this._client!.subscribe(`/topic/chat/${idChat}`, (imessage: Stomp.IMessage) => {
          const message: Mensagem = JSON.parse(imessage.body);
          this._mensagemRespostaSubject.next(message);
        });
      }

    });

    this._client.onWebSocketClose = () => {
      if (this._activeUrl?.includes('chat')) {
        this.connect(idChat);
      }
    }

  }

  isConnected() {
    return this._client?.connected;
  }

  disconnect() {
    this._client?.disconnect();
  }

  enviarMensagem(mensagem: Mensagem) {
    return this.http.post(`${environment.target}/mensagem`, mensagem);
  }


  public get mensagemRespostaSubject(): BehaviorSubject<Mensagem> {
    return this._mensagemRespostaSubject;
  }


}
