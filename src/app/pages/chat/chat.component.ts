import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { faBars, faClose } from '@fortawesome/free-solid-svg-icons';
import { Subject, catchError, combineLatest, debounceTime, delay, of } from 'rxjs';
import { Chat } from 'src/app/core/models/chat.models';
import { Mensagem } from 'src/app/core/models/mensagem.models';
import { ChatService } from 'src/app/core/services/chat.service';
import { LoadingService } from 'src/app/core/services/loading.service';
import { UserService } from 'src/app/core/services/user.service';
import { WebsocketService } from 'src/app/core/services/websocket.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy {

  @ViewChild('chatbox') chatbox!: ElementRef<any>;
  @ViewChild('textarea') textarea!: ElementRef<HTMLTextAreaElement>

  bars = faBars;
  close = faClose;

  chatSelecionado?: Chat
  idNecessidadeSelecionada!: number;
  nomeUsuario?: string;

  topicos: Chat[] = [];
  mensagens: Mensagem[] = [];

  sidebarHabilitada: boolean = false;

  mensagemFormControl: FormControl = new FormControl('', [Validators.required, Validators.maxLength(255)]);

  submitted: boolean = false;

  isLoading: boolean = false;

  private mensagemEnviada = new Subject<string>();

  constructor(
    private loadingService: LoadingService,
    private chatService: ChatService,
    private webSocketService: WebsocketService,
    private userService: UserService,
    private activeRoute: ActivatedRoute,
    private router: Router,
  ) { }
  ngOnDestroy(): void {
    if(this.webSocketService.isConnected()) {
      this.webSocketService.disconnect();
    }
    this.webSocketService.mensagemRespostaSubject.next({} as Mensagem);
  }

  ngOnInit(): void {

    this.nomeUsuario = this.userService.dadosLogin.getValue()?.body?.usuarioLogado;

    this.loadingService.loadingSub.pipe(delay(0))
      .subscribe((loading) => {
        this.isLoading = loading;
      })

    const mensagemEnviadaDebounce = this.mensagemEnviada.pipe(debounceTime(1000));

    mensagemEnviadaDebounce.subscribe({
      next: (value) => {
        this.webSocketService.enviarMensagem({
          idChat: this.chatSelecionado!.id!,
          texto: value,
          origemMensagem: 'USUARIO_ABERTURA'
        }).subscribe({
          next: _ => {
            this.mensagemFormControl.setValue('');
            this.checkContent();
          },
          complete: () => {
            this.submitted = false;
          }
        });
      }
    });

    combineLatest([
      this.activeRoute.params,
      this.activeRoute.queryParams.pipe(catchError(_ => of({ message: 'newChatId param not found' })))
    ]).subscribe({
      next: ([path, query]) => {

        const isParams = (query: any): query is Params => {
          return (<Params>query)['newChatId'] !== undefined;
        }

        this.idNecessidadeSelecionada = Number(path['idNecessidade']);

        if (isParams(query)) {
          const chatId = Number((query as Params)['newChatId']);
          this.carregarMeusChats(chatId);
          this.carregarMensagens({ id: chatId });
        } else {
          this.carregarMeusChats();
        }

      }
    })

    this.webSocketService.mensagemRespostaSubject.subscribe({
      next: (resposta) => {
        if (resposta.texto && this.mensagens.find(m => m.id == resposta.id) === undefined) {
          this.mensagens.push(resposta);
          setTimeout(() => {
            this.chatbox.nativeElement.scrollTop = this.chatbox.nativeElement.scrollHeight;
          }, 200)
        }
      },
    })
  }

  carregarMeusChats(newChatId?: number) {
    this.chatService.meusChats().subscribe({
      next: (response) => {
        this.topicos = response.body
          .filter(c => c.idNecessidade === this.idNecessidadeSelecionada);
        if (newChatId) {
          this.chatSelecionado = this.topicos.find(t => t.id === newChatId);
        }
      }
    });
  }

  criarChat(chat: Chat) {
    this.chatService.criar({ idNecessidade: this.idNecessidadeSelecionada, tipoAssistente: 'IA', titulo: chat.titulo! })
      .subscribe({
        next: (response) => {

          const urlArr = response.headers.get('Location')?.split('/');

          const newChatId = Number(urlArr?.pop());

          this.carregarMeusChats(newChatId);

          this.webSocketService.connect(newChatId);

          this.mensagens = [];

        }
      })
  }

  carregarMensagens(chat: Chat) {
    this.webSocketService.disconnect();
    this.chatSelecionado = { ...chat };
    this.mensagens = [];
    this.chatService.carregarMensagens(chat.id!).subscribe({
      next: (response) => {
        this.webSocketService.connect(chat.id!);
        this.mensagens = response.body;
        this.sidebarHabilitada = false;
        setTimeout(() => {
          this.chatbox.nativeElement.scrollTop = this.chatbox.nativeElement.scrollHeight;
        }, 200)
      },
      error: (error: HttpErrorResponse) => {
        this.sidebarHabilitada = false;
        if (error.status == 404 && !this.webSocketService.isConnected()) {
          this.webSocketService.connect(chat.id!);
        }
        if (error.status == 403) {
          this.webSocketService.disconnect();
          this.router.navigate(['/']);
        }
      }
    });
  }

  autogrow(event: KeyboardEvent) {

    const textArea = this.textarea.nativeElement;

    if (event.key == 'Enter' && !event.shiftKey) {
      event.preventDefault();
    } else {
      textArea.style.overflow = 'hidden';
      textArea.style.height = '0px';
      textArea.style.height = textArea.scrollHeight + 'px';
    }

  }

  checkContent() {
    const textArea = this.textarea.nativeElement;
    if(!textArea.value) {
      textArea.style.height = '50px';
    }
  }

  enviarMensagem() {
    this.submitted = true;
    if (this.mensagemFormControl.valid) {
      this.mensagemEnviada.next(this.mensagemFormControl.value);
    }
  }

}
